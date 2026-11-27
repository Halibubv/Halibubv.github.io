<?php
// Бронь столиков: свободное время, создание брони с подбором столика,
// кабинет клиента и работа администратора с бронями.

const RESERVATION_HOURS = 2;          // бронь длится 2 часа
const RESERVATION_DAYS_AHEAD = 14;    // бронировать можно на 14 дней вперёд (сегодня + 13)
const RESERVATION_MAX_GUESTS = 8;
// Статусы, при которых столик считается занятым. closed (завершена), cancelled и no_show его освобождают.
const RESERVATION_BUSY = ['new', 'confirmed', 'seated'];
// Куда администратор может перевести бронь из каждого статуса.
const RESERVATION_NEXT = [
    'new' => ['confirmed', 'cancelled', 'no_show'],
    'confirmed' => ['seated', 'cancelled', 'no_show'],
    'seated' => ['closed'],
    'closed' => [],
    'cancelled' => [],
    'no_show' => [],
];
const TABLE_ZONES = ['window' => 'у окна', 'sofa' => 'диван', 'big' => 'большой стол'];

// SQL-условие «бронь занимает столик» для запросов ниже.
function busy_statuses_sql()
{
    return "'" . implode("','", RESERVATION_BUSY) . "'";
}

// Время начала брони в выбранный день: каждые 30 минут от открытия,
// последняя бронь — за 1,5 часа до закрытия. Сегодня — только время, до которого
// осталось не меньше 30 минут.
function slot_times($date)
{
    $hours = hours_on($date);
    if (!$hours) {
        return [];
    }
    $earliest = (new DateTimeImmutable())->modify('+30 minutes');
    $last = $hours['closes']->modify('-90 minutes');
    $times = [];
    for ($time = $hours['opens']; $time <= $last; $time = $time->modify('+30 minutes')) {
        if ($time >= $earliest) {
            $times[] = $time->format('H:i');
        }
    }
    return $times;
}

// Дата брони: от сегодня до 13 дней вперёд.
function reservation_date_value($data)
{
    $date = date_value($data, 'date');
    $today = date('Y-m-d');
    $lastDay = date('Y-m-d', strtotime('+' . (RESERVATION_DAYS_AHEAD - 1) . ' days'));
    if ($date < $today || $date > $lastDay) {
        invalid('date', 'Бронировать можно на ближайшие 14 дней.');
    }
    return $date;
}

// Свободное время для формы на сайте: GET /api/slots?date=2026-11-27&guests=2.
function reservation_slots($params)
{
    $date = reservation_date_value($params);
    $guests = int_value($params, 'guests', 1, RESERVATION_MAX_GUESTS);

    // Столики, куда помещаются гости, и все брони этого дня — одним запросом каждое,
    // дальше считаем в PHP.
    $tables = query('SELECT id FROM cafe_tables WHERE is_active = 1 AND seats >= ?', [$guests])->fetchAll(PDO::FETCH_COLUMN);
    $bookings = query('SELECT table_id, starts_at, ends_at FROM reservations
        WHERE status IN (' . busy_statuses_sql() . ') AND starts_at < ? AND ends_at > ?',
        [$date . ' 23:59:59', $date . ' 00:00:00'])->fetchAll();

    $slots = [];
    foreach (slot_times($date) as $time) {
        $start = "$date $time:00";
        $end = date('Y-m-d H:i:s', strtotime($start) + RESERVATION_HOURS * 3600);
        $free = false;
        foreach ($tables as $tableId) {
            $taken = false;
            foreach ($bookings as $booking) {
                // Две брони пересекаются, если одна начинается раньше, чем кончается другая, и наоборот.
                if ((int) $booking['table_id'] === (int) $tableId && $booking['starts_at'] < $end && $booking['ends_at'] > $start) {
                    $taken = true;
                    break;
                }
            }
            if (!$taken) {
                $free = true;
                break;
            }
        }
        $slots[] = ['time' => $time, 'free' => $free];
    }

    $note = null;
    if (!$tables) {
        $note = 'Столика на столько гостей нет. Для большой компании лучше позвонить нам.';
    } elseif (!$slots) {
        $note = hours_on($date) ? 'На этот день время для брони уже прошло.' : 'В этот день мы не работаем.';
    }
    return ['date' => $date, 'guests' => $guests, 'slots' => $slots, 'note' => $note];
}

// Свободен ли столик с $start по $end. $exceptId — не учитывать эту бронь (при пересадке).
function table_is_free($tableId, $start, $end, $exceptId = 0)
{
    $taken = query('SELECT 1 FROM reservations WHERE table_id = ? AND id <> ? AND status IN (' . busy_statuses_sql() . ')
        AND starts_at < ? AND ends_at > ? LIMIT 1', [$tableId, $exceptId, $end, $start])->fetchColumn();
    return !$taken;
}

// Самый маленький свободный столик, куда помещаются гости. Вызывать внутри транзакции:
// FOR UPDATE блокирует подходящие столики до конца транзакции, поэтому две брони
// в одну и ту же секунду проверяются по очереди и не займут один столик дважды.
function find_free_table($guests, $start, $end)
{
    $tables = query('SELECT id, label, seats, zone FROM cafe_tables WHERE is_active = 1 AND seats >= ?
        ORDER BY seats, id FOR UPDATE', [$guests])->fetchAll();
    foreach ($tables as $table) {
        if (table_is_free($table['id'], $start, $end)) {
            return $table;
        }
    }
    return null;
}

// Новая бронь с сайта. $user — вошедший клиент или null для гостя.
function create_reservation($data, $user)
{
    $date = reservation_date_value($data);
    $time = time_value($data, 'time');
    $guests = int_value($data, 'guests', 1, RESERVATION_MAX_GUESTS);
    $name = text_value($data, 'name', 100, 2);
    $phone = phone_value($data);
    $comment = optional_text_value($data, 'comment', 300);

    if (!in_array($time, slot_times($date), true)) {
        invalid('time', 'Это время недоступно для брони. Выберите другое.');
    }
    $start = "$date $time:00";
    $end = date('Y-m-d H:i:s', strtotime($start) + RESERVATION_HOURS * 3600);
    $userId = $user ? $user['id'] : null;

    $id = transaction(function () use ($guests, $start, $end, $userId, $name, $phone, $comment) {
        $table = find_free_table($guests, $start, $end);
        if (!$table) {
            send_error(409, 'На это время свободных столиков уже нет. Выберите другое время.');
        }
        $id = insert('INSERT INTO reservations (user_id, table_id, starts_at, ends_at, guests, customer_name, phone, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$userId, $table['id'], $start, $end, $guests, $name, $phone, $comment]);
        log_status('reservation', $id, 'new', $userId);
        return $id;
    });

    $reservation = find_reservation($id);
    notify_telegram("Новая бронь №{$id}\n" . format_day($reservation['starts_at']) . ', ' . substr($reservation['starts_at'], 11, 5)
        . "\nГостей: {$guests}, столик {$reservation['table_label']} ({$reservation['zone_name']})\n{$name}, {$phone}"
        . ($comment ? "\n«{$comment}»" : ''));
    return $reservation;
}

// Одна бронь вместе со столиком.
function find_reservation($id)
{
    $row = query('SELECT r.*, t.label AS table_label, t.zone, t.seats FROM reservations r
        JOIN cafe_tables t ON t.id = r.table_id WHERE r.id = ?', [$id])->fetch();
    if (!$row) {
        send_error(404, 'Бронь не найдена.');
    }
    return reservation_row($row);
}

function reservation_row($row)
{
    $row['zone_name'] = TABLE_ZONES[$row['zone']] ?? $row['zone'];
    $row['starts_at'] = substr($row['starts_at'], 0, 16);
    $row['ends_at'] = substr($row['ends_at'], 0, 16);
    return $row;
}

// «27 ноября, пятница» для уведомлений.
function format_day($datetime)
{
    $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    $time = strtotime($datetime);
    return date('j', $time) . ' ' . $months[(int) date('n', $time) - 1];
}

// --- Кабинет клиента ---

// Брони клиента, новые сверху. Только свои: условие user_id = ? в запросе.
function user_reservations($userId)
{
    $rows = query('SELECT r.id, r.starts_at, r.ends_at, r.guests, r.comment, r.status, r.created_at, t.label AS table_label, t.zone
        FROM reservations r JOIN cafe_tables t ON t.id = r.table_id
        WHERE r.user_id = ? ORDER BY r.starts_at DESC LIMIT 100', [$userId])->fetchAll();
    $now = date('Y-m-d H:i');
    $result = [];
    foreach ($rows as $row) {
        $row = reservation_row($row);
        $row['can_cancel'] = can_cancel_reservation($row);
        $row['upcoming'] = $row['ends_at'] > $now && in_array($row['status'], RESERVATION_BUSY, true);
        $result[] = $row;
    }
    return $result;
}

// Отменить бронь клиент может сам, но не позже чем за час до начала.
function can_cancel_reservation($reservation)
{
    $hourBefore = date('Y-m-d H:i', strtotime($reservation['starts_at']) - 3600);
    return in_array($reservation['status'], ['new', 'confirmed'], true) && date('Y-m-d H:i') <= $hourBefore;
}

function cancel_own_reservation($id, $user)
{
    $reservation = transaction(function () use ($id, $user) {
        // Чужая бронь для клиента «не найдена»: так нельзя даже узнать, что она есть.
        $row = query('SELECT * FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE', [$id, $user['id']])->fetch();
        if (!$row) {
            send_error(404, 'Бронь не найдена.');
        }
        $row = reservation_row($row);
        if (!in_array($row['status'], ['new', 'confirmed'], true)) {
            send_error(409, 'Эту бронь уже нельзя отменить.');
        }
        if (!can_cancel_reservation($row)) {
            send_error(409, 'Отменить бронь можно не позже чем за час до начала. Позвоните нам, пожалуйста.');
        }
        query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [$id]);
        log_status('reservation', $id, 'cancelled', $user['id']);
        return $row;
    });
    notify_telegram("Гость отменил бронь №{$id} на " . format_day($reservation['starts_at']) . ', ' . substr($reservation['starts_at'], 11, 5));
}

// --- Админка ---

// Брони на день по времени.
function admin_reservations($date)
{
    $rows = query('SELECT r.*, t.label AS table_label, t.zone, t.seats FROM reservations r
        JOIN cafe_tables t ON t.id = r.table_id
        WHERE r.starts_at >= ? AND r.starts_at < ? + INTERVAL 1 DAY ORDER BY r.starts_at, t.label', [$date, $date])->fetchAll();
    return array_map('reservation_row', $rows);
}

function set_reservation_status($id, $data, $admin)
{
    $status = choice_value($data, 'status', array_keys(RESERVATION_NEXT), 'Неизвестный статус.');
    transaction(function () use ($id, $status, $admin) {
        $current = query('SELECT status FROM reservations WHERE id = ? FOR UPDATE', [$id])->fetchColumn();
        if ($current === false) {
            send_error(404, 'Бронь не найдена.');
        }
        if (!in_array($status, RESERVATION_NEXT[$current], true)) {
            send_error(409, 'Бронь уже в другом статусе. Обновите страницу.');
        }
        query('UPDATE reservations SET status = ? WHERE id = ?', [$status, $id]);
        log_status('reservation', $id, $status, $admin['id']);
    });
    return find_reservation($id);
}

// Столики, за которые можно пересадить гостей этой брони: помещаются и свободны в это время.
function free_tables_for($id)
{
    $reservation = find_reservation($id);
    $tables = query('SELECT id, label, seats, zone FROM cafe_tables WHERE is_active = 1 AND seats >= ? AND id <> ?
        ORDER BY seats, label', [$reservation['guests'], $reservation['table_id']])->fetchAll();
    $free = [];
    foreach ($tables as $table) {
        if (table_is_free($table['id'], $reservation['starts_at'], $reservation['ends_at'], $id)) {
            $table['zone_name'] = TABLE_ZONES[$table['zone']];
            $free[] = $table;
        }
    }
    return $free;
}

// Пересадить за другой столик. Проверка и смена — в одной транзакции с блокировкой столика.
function move_reservation($id, $data, $admin)
{
    $tableId = int_value($data, 'table_id', 1, PHP_INT_MAX);
    transaction(function () use ($id, $tableId) {
        $reservation = query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [$id])->fetch();
        if (!$reservation) {
            send_error(404, 'Бронь не найдена.');
        }
        if (!in_array($reservation['status'], RESERVATION_BUSY, true)) {
            send_error(409, 'Пересадить можно только действующую бронь.');
        }
        $table = query('SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE', [$tableId])->fetch();
        if (!$table || !$table['is_active']) {
            invalid('table_id', 'Такого столика нет.');
        }
        if ($table['seats'] < $reservation['guests']) {
            invalid('table_id', 'За этим столиком не хватит мест.');
        }
        if (!table_is_free($tableId, $reservation['starts_at'], $reservation['ends_at'], $id)) {
            send_error(409, 'Этот столик в это время уже занят.');
        }
        query('UPDATE reservations SET table_id = ? WHERE id = ?', [$tableId, $id]);
    });
    return find_reservation($id);
}

// --- Админка: столики ---

function list_tables()
{
    $rows = query('SELECT * FROM cafe_tables ORDER BY CAST(label AS UNSIGNED), label')->fetchAll();
    foreach ($rows as &$row) {
        $row['zone_name'] = TABLE_ZONES[$row['zone']];
        $row['is_active'] = (bool) $row['is_active'];
    }
    return $rows;
}

function save_table($data, $id = null)
{
    $label = text_value($data, 'label', 20);
    $seats = int_value($data, 'seats', 1, 12);
    $zone = choice_value($data, 'zone', array_keys(TABLE_ZONES), 'Выберите зону.');
    $active = bool_value($data, 'is_active');
    $same = query('SELECT id FROM cafe_tables WHERE label = ? AND id <> ?', [$label, $id ?? 0])->fetchColumn();
    if ($same) {
        invalid('label', 'Столик с таким номером уже есть.');
    }
    if ($id === null) {
        insert('INSERT INTO cafe_tables (label, seats, zone, is_active) VALUES (?, ?, ?, ?)', [$label, $seats, $zone, $active ? 1 : 0]);
        return;
    }
    if (!query('SELECT id FROM cafe_tables WHERE id = ?', [$id])->fetch()) {
        send_error(404, 'Столик не найден.');
    }
    query('UPDATE cafe_tables SET label = ?, seats = ?, zone = ?, is_active = ? WHERE id = ?', [$label, $seats, $zone, $active ? 1 : 0, $id]);
}
