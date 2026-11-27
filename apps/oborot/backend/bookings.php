<?php
// Записи на сервис: создание с лендинга, список и отмена в кабинете клиента.

// Названия статусов по-русски (для Telegram и истории).
const STATUS_LABELS = [
    'new' => 'новая',
    'confirmed' => 'подтверждена',
    'in_work' => 'в работе',
    'done' => 'выполнена',
    'cancelled' => 'отменена',
    'no_show' => 'не приехал',
];

// Допустимые переходы статуса: из какого в какие можно перейти.
const STATUS_TRANSITIONS = [
    'new' => ['confirmed', 'cancelled', 'no_show'],
    'confirmed' => ['in_work', 'cancelled', 'no_show'],
    'in_work' => ['done'],
    'done' => [],
    'cancelled' => [],
    'no_show' => [],
];

// Клиент может отменить запись не позже чем за 2 часа до начала.
const CANCEL_HOURS_BEFORE = 2;

// Новая запись: POST /api/bookings. $user — вошедший клиент или null у гостя.
function create_booking($user, $data)
{
    // --- Проверяем поля формы ---
    $codes = list_value($data, 'services', 'Выберите услуги.');
    $codes = array_values(array_unique(array_filter($codes, 'is_string')));
    if (count($codes) === 0) {
        invalid('services', 'Выберите хотя бы одну услугу.');
    }
    if (count($codes) > 20) {
        invalid('services', 'Слишком много услуг.');
    }
    $placeholders = implode(',', array_fill(0, count($codes), '?'));
    $services = query("SELECT id, code, name, base_price, hours FROM services
        WHERE is_active = 1 AND code IN ($placeholders) ORDER BY sort, id", $codes)->fetchAll();
    if (count($services) !== count($codes)) {
        invalid('services', 'Некоторых услуг нет в прайсе. Обновите страницу.');
    }

    // Машина из гаража: только своя. Тогда марку и кузов берём из карточки машины.
    $carId = optional_int_value($data, 'car_id', 1, PHP_INT_MAX);
    if ($carId !== null) {
        if (!$user) {
            invalid('car_id', 'Чтобы выбрать машину из гаража, войдите в аккаунт.');
        }
        $car = query('SELECT id, brand, body FROM cars WHERE id = ? AND user_id = ?', [$carId, $user['id']])->fetch();
        if (!$car) {
            invalid('car_id', 'Машина не найдена в вашем гараже.');
        }
        $brand = $car['brand'];
        $body = $car['body'];
    } else {
        $brand = text_value($data, 'brand', 60);
        if (!query('SELECT id FROM brands WHERE name = ?', [$brand])->fetchColumn()) {
            invalid('brand', 'Выберите марку из списка.');
        }
        $body = choice_value($data, 'body', array_keys(BODIES), 'Выберите тип кузова.');
    }

    $date = date_value($data, 'date');
    if (!bookable_date($date)) {
        invalid('date', 'Записаться можно на сегодня и ближайшие ' . BOOKING_DAYS . ' дней.');
    }
    $time = $data['time'] ?? '';
    if (!is_string($time) || !preg_match('/^(\d{2}):00$/', $time, $match)) {
        invalid('time', 'Выберите время.');
    }
    $hour = (int) $match[1];
    $name = text_value($data, 'name', 100, 2);
    $phone = phone_value($data);
    $comment = optional_text_value($data, 'comment', 500);

    // --- Считаем цену и длительность сами ---
    $order = price_order($brand, $body, $services);
    $settings = schedule_settings();
    $start = new DateTimeImmutable(sprintf('%s %02d:00', $date, $hour));
    $end = $start->modify('+' . $order['slot_hours'] . ' hours');
    if ($start <= new DateTimeImmutable()) {
        invalid('time', 'Это время уже прошло. Выберите другое.');
    }
    if ($hour < $settings['open_hour'] || $hour + $order['slot_hours'] > $settings['close_hour']) {
        invalid('time', 'Работы не успеют закончиться до закрытия. Выберите время пораньше.');
    }

    // --- Сохраняем в транзакции с блокировкой ---
    // SELECT ... FOR UPDATE блокирует строку настройки posts до конца транзакции.
    // Пока одна запись проверяет свободные посты и сохраняется, вторая ждёт своей очереди,
    // поэтому два клиента не могут одновременно занять последний пост.
    $db = database();
    $db->beginTransaction();
    try {
        query("SELECT value FROM settings WHERE `key` = 'posts' FOR UPDATE");
        $load = hour_load($date);
        if (free_posts($load, $hour, $order['slot_hours'], $settings) === 0) {
            $db->rollBack();
            send_error(409, 'Это время только что заняли. Выберите другое.', ['time' => 'Время занято.']);
        }

        $bookingId = insert('INSERT INTO bookings (user_id, car_id, brand, body, starts_at, ends_at,
            customer_name, phone, comment, subtotal, discount, total, hours, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            $user['id'] ?? null, $carId, $brand, $body, $start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s'),
            $name, $phone, $comment, $order['subtotal'], $order['discount'], $order['total'], $order['hours'], 'new',
        ]);
        foreach ($order['items'] as $item) {
            // Снимок услуги на момент записи: если прайс потом поменяют, в записи останется эта цена.
            query('INSERT INTO booking_items (booking_id, service_id, name, price, hours) VALUES (?, ?, ?, ?, ?)',
                [$bookingId, $item['service_id'], $item['name'], $item['price'], $item['hours']]);
        }
        query('INSERT INTO booking_events (booking_id, status, user_id) VALUES (?, ?, ?)',
            [$bookingId, 'new', $user['id'] ?? null]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }

    $booking = find_booking($bookingId);
    notify_new_booking($booking);
    return $booking;
}

// Запись с услугами по id (или null). Используется и в кабинете, и в админке.
function find_booking($id)
{
    $booking = query('SELECT b.*, c.model AS car_model, c.plate AS car_plate, c.year AS car_year,
        u.email AS user_email
        FROM bookings b
        LEFT JOIN cars c ON c.id = b.car_id
        LEFT JOIN users u ON u.id = b.user_id
        WHERE b.id = ?', [$id])->fetch();
    if (!$booking) {
        return null;
    }
    return with_items([$booking])[0];
}

// Добавляет к записям список услуг и приводит поля к удобному виду.
function with_items($bookings)
{
    if (count($bookings) === 0) {
        return [];
    }
    $ids = array_column($bookings, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $items = query("SELECT booking_id, service_id, name, price, hours FROM booking_items
        WHERE booking_id IN ($placeholders) ORDER BY id", $ids)->fetchAll();
    $byBooking = [];
    foreach ($items as $item) {
        $item['hours'] = (float) $item['hours'];
        $byBooking[$item['booking_id']][] = $item;
    }
    foreach ($bookings as &$booking) {
        $booking['items'] = $byBooking[$booking['id']] ?? [];
        $booking['number'] = booking_number($booking['id']);
        $booking['hours'] = (float) $booking['hours'];
        $booking['is_demo'] = (bool) $booking['is_demo'];
        $booking['body_name'] = BODIES[$booking['body']]['name'] ?? $booking['body'];
        $booking['status_label'] = STATUS_LABELS[$booking['status']] ?? $booking['status'];
        $booking['next_statuses'] = STATUS_TRANSITIONS[$booking['status']] ?? [];
        $booking['can_cancel'] = can_cancel($booking);
    }
    return $bookings;
}

// Номер записи для клиента: 42 → «00042».
function booking_number($id)
{
    return str_pad((string) $id, 5, '0', STR_PAD_LEFT);
}

function can_cancel($booking)
{
    if (!in_array($booking['status'], ['new', 'confirmed'], true)) {
        return false;
    }
    $limit = (new DateTimeImmutable($booking['starts_at']))->modify('-' . CANCEL_HOURS_BEFORE . ' hours');
    return new DateTimeImmutable() <= $limit;
}

// --- Кабинет клиента ---

// Свои записи клиента: и ближайшие, и прошлые. Чужие сюда не попадают (user_id = ?).
function list_my_bookings($userId)
{
    $bookings = query('SELECT b.*, c.model AS car_model, c.plate AS car_plate, c.year AS car_year, NULL AS user_email
        FROM bookings b LEFT JOIN cars c ON c.id = b.car_id
        WHERE b.user_id = ? ORDER BY b.starts_at DESC', [$userId])->fetchAll();
    return with_items($bookings);
}

// Отмена записи клиентом. Чужая запись — 404: не подсказываем, что такая запись есть.
function cancel_my_booking($userId, $bookingId)
{
    $booking = query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [$bookingId, $userId])->fetch();
    if (!$booking) {
        send_error(404, 'Запись не найдена.');
    }
    if (!in_array($booking['status'], ['new', 'confirmed'], true)) {
        send_error(409, 'Эту запись уже нельзя отменить: она ' . STATUS_LABELS[$booking['status']] . '.');
    }
    if (!can_cancel($booking)) {
        send_error(409, 'Отменить запись можно не позже чем за ' . CANCEL_HOURS_BEFORE
            . ' часа до начала. Позвоните в сервис.');
    }
    set_booking_status($bookingId, 'cancelled', $userId);
    return find_booking($bookingId);
}

// Смена статуса с записью в историю.
function set_booking_status($bookingId, $status, $userId)
{
    query('UPDATE bookings SET status = ? WHERE id = ?', [$status, $bookingId]);
    query('INSERT INTO booking_events (booking_id, status, user_id) VALUES (?, ?, ?)', [$bookingId, $status, $userId]);
}
