<?php
// Админка сервиса: сводка, записи, расписание по постам, прайс, клиенты, настройки.
// Все функции вызываются только после require_admin() в public/index.php.

// --- Сводка ---
// Все цифры считаются из базы: записи на сегодня, новые, загрузка постов, выручка за 7 дней.
function admin_summary()
{
    $today = date('Y-m-d');
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $todayBookings = query('SELECT b.*, NULL AS car_model, NULL AS car_plate, NULL AS car_year, NULL AS user_email
        FROM bookings b WHERE b.starts_at >= ? AND b.starts_at < ? ORDER BY b.starts_at, b.id',
        [$today, $tomorrow])->fetchAll();
    $newCount = (int) query("SELECT COUNT(*) FROM bookings WHERE status = 'new' AND starts_at >= ?", [$today])->fetchColumn();
    $revenue = query("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count FROM bookings
        WHERE status = 'done' AND starts_at >= ? AND starts_at < ?",
        [date('Y-m-d', strtotime('-6 days')), $tomorrow])->fetch();

    return [
        'today' => $today,
        'bookings_today' => with_items($todayBookings),
        'new_count' => $newCount,
        'load' => [day_load($today), day_load($tomorrow)],
        'revenue_7_days' => (int) $revenue['total'],
        'done_7_days' => (int) $revenue['count'],
    ];
}

// Загрузка постов за день: сколько «пост-часов» занято из возможных.
function day_load($date)
{
    $settings = schedule_settings();
    $load = hour_load($date);
    $capacity = $settings['posts'] * max(1, $settings['close_hour'] - $settings['open_hour']);
    $busy = array_sum($load);
    $count = query("SELECT COUNT(*) FROM bookings WHERE starts_at >= ? AND starts_at < ?
        AND status IN ('new', 'confirmed', 'in_work', 'done')",
        [$date, date('Y-m-d', strtotime("$date +1 day"))])->fetchColumn();
    return [
        'date' => $date,
        'busy_hours' => $busy,
        'capacity_hours' => $capacity,
        'percent' => (int) round($busy * 100 / $capacity),
        'bookings' => (int) $count,
        'by_hour' => $load,
        'posts' => $settings['posts'],
    ];
}

// --- Записи ---
// Фильтры из адреса: ?from=2026-11-27&to=2026-12-01&status=new&q=Иван
function admin_list_bookings($filters)
{
    $where = [];
    $values = [];
    if (!empty($filters['from'])) {
        $where[] = 'b.starts_at >= ?';
        $values[] = date_value($filters, 'from');
    }
    if (!empty($filters['to'])) {
        $where[] = 'b.starts_at < ?';
        $values[] = date('Y-m-d', strtotime(date_value($filters, 'to') . ' +1 day'));
    }
    if (!empty($filters['status'])) {
        $where[] = 'b.status = ?';
        $values[] = choice_value($filters, 'status', array_keys(STATUS_LABELS), 'Неизвестный статус.');
    }
    $search = trim((string) ($filters['q'] ?? ''));
    if ($search !== '') {
        // Поиск по имени и по телефону. По телефону ищем по цифрам: «999 12» найдёт +7 (999) 12…
        $digits = preg_replace('/\D/', '', $search);
        $condition = 'b.customer_name LIKE ?';
        $values[] = '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%';
        if ($digits !== '') {
            $condition .= " OR REGEXP_REPLACE(b.phone, '[^0-9]', '') LIKE ?";
            $values[] = '%' . $digits . '%';
        }
        $where[] = "($condition)";
    }
    $sql = 'SELECT b.*, c.model AS car_model, c.plate AS car_plate, c.year AS car_year, u.email AS user_email
        FROM bookings b LEFT JOIN cars c ON c.id = b.car_id LEFT JOIN users u ON u.id = b.user_id';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    // Если задана дата «от», показываем по порядку от ближайших, иначе — сначала свежие.
    $sql .= !empty($filters['from']) ? ' ORDER BY b.starts_at, b.id' : ' ORDER BY b.starts_at DESC, b.id DESC';
    $sql .= ' LIMIT 300';
    return with_items(query($sql, $values)->fetchAll());
}

// Карточка записи с историей смены статуса.
function admin_find_booking($id)
{
    $booking = find_booking($id);
    if (!$booking) {
        send_error(404, 'Запись не найдена.');
    }
    $events = query('SELECT e.status, e.created_at, u.name AS user_name, u.role AS user_role
        FROM booking_events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.booking_id = ? ORDER BY e.created_at, e.id', [$id])->fetchAll();
    foreach ($events as &$event) {
        $event['status_label'] = STATUS_LABELS[$event['status']] ?? $event['status'];
    }
    $booking['events'] = $events;
    return $booking;
}

// Смена статуса: только по разрешённым переходам (STATUS_TRANSITIONS в bookings.php).
function admin_set_status($admin, $id, $data)
{
    $booking = find_booking($id);
    if (!$booking) {
        send_error(404, 'Запись не найдена.');
    }
    $status = choice_value($data, 'status', array_keys(STATUS_LABELS), 'Неизвестный статус.');
    if (!in_array($status, STATUS_TRANSITIONS[$booking['status']], true)) {
        send_error(409, 'Нельзя перевести запись из статуса «' . STATUS_LABELS[$booking['status']]
            . '» в «' . STATUS_LABELS[$status] . '».');
    }
    set_booking_status($id, $status, $admin['id']);
    return admin_find_booking($id);
}

// --- Расписание: день по постам ---
// Раскладываем записи по постам: каждую ставим на первый пост, который к её началу свободен.
// Номер поста здесь условный: в базе хранится только время, а пост выбирает мастер.
function admin_schedule($date)
{
    $settings = schedule_settings();
    $bookings = query("SELECT b.*, NULL AS car_model, NULL AS car_plate, NULL AS car_year, NULL AS user_email
        FROM bookings b WHERE starts_at >= ? AND starts_at < ? AND status IN ('new', 'confirmed', 'in_work', 'done')
        ORDER BY starts_at, ends_at DESC, id", [$date, date('Y-m-d', strtotime("$date +1 day"))])->fetchAll();
    $bookings = with_items($bookings);

    $postFreeAt = array_fill(0, $settings['posts'], '');
    foreach ($bookings as &$booking) {
        $booking['post'] = null;
        foreach ($postFreeAt as $post => $freeAt) {
            if ($freeAt <= $booking['starts_at']) {
                $booking['post'] = $post + 1;
                $postFreeAt[$post] = $booking['ends_at'];
                break;
            }
        }
    }
    return ['date' => $date, 'settings' => $settings, 'bookings' => $bookings];
}

// --- Прайс ---
function admin_list_services()
{
    $services = query('SELECT s.*, (SELECT COUNT(*) FROM booking_items i WHERE i.service_id = s.id) AS used
        FROM services s ORDER BY s.sort, s.id')->fetchAll();
    foreach ($services as &$service) {
        $service['hours'] = (float) $service['hours'];
        $service['is_active'] = (bool) $service['is_active'];
    }
    return $services;
}

function admin_save_service($data, $id = null)
{
    if ($id !== null && !query('SELECT id FROM services WHERE id = ?', [$id])->fetchColumn()) {
        send_error(404, 'Услуга не найдена.');
    }
    $name = text_value($data, 'name', 100);
    $description = optional_text_value($data, 'description', 255) ?? '';
    $price = int_value($data, 'base_price', 0, 1000000);
    $hours = decimal_value($data, 'hours', 0.25, 12);
    $sort = int_value($data, 'sort', 0, 1000);
    $active = bool_value($data, 'is_active');

    if ($id === null) {
        // Код услуги — латиницей, по нему лендинг выбирает значок. Для новой услуги
        // его можно задать, иначе составим сами: svc12.
        $code = trim((string) ($data['code'] ?? ''));
        if ($code !== '' && !preg_match('/^[a-z0-9_-]{2,30}$/', $code)) {
            invalid('code', 'Код: латинские буквы, цифры, - и _, от 2 до 30 символов.');
        }
        if ($code !== '' && query('SELECT id FROM services WHERE code = ?', [$code])->fetchColumn()) {
            invalid('code', 'Такой код уже есть.');
        }
        $id = insert('INSERT INTO services (code, name, description, base_price, hours, sort, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)', [$code !== '' ? $code : 'tmp-' . bin2hex(random_bytes(6)),
            $name, $description, $price, $hours, $sort, $active ? 1 : 0]);
        if ($code === '') {
            query('UPDATE services SET code = ? WHERE id = ?', ['svc' . $id, $id]);
        }
    } else {
        // Прошлые записи хранят свою цену в booking_items, поэтому менять прайс безопасно.
        query('UPDATE services SET name = ?, description = ?, base_price = ?, hours = ?, sort = ?, is_active = ?
            WHERE id = ?', [$name, $description, $price, $hours, $sort, $active ? 1 : 0, $id]);
    }
    return admin_list_services();
}

// Удалить можно только услугу, которой нет ни в одной записи. Иначе — только скрыть.
function admin_delete_service($id)
{
    if (!query('SELECT id FROM services WHERE id = ?', [$id])->fetchColumn()) {
        send_error(404, 'Услуга не найдена.');
    }
    if (query('SELECT COUNT(*) FROM booking_items WHERE service_id = ?', [$id])->fetchColumn() > 0) {
        send_error(409, 'Эта услуга есть в записях, её можно только скрыть.');
    }
    query('DELETE FROM services WHERE id = ?', [$id]);
    return admin_list_services();
}

// --- Клиенты ---
function admin_list_clients()
{
    $users = query('SELECT u.id, u.email, u.name, u.phone, u.role, u.is_demo, u.created_at,
        COUNT(b.id) AS bookings_count, MAX(b.starts_at) AS last_booking
        FROM users u LEFT JOIN bookings b ON b.user_id = u.id
        GROUP BY u.id ORDER BY u.role = \'admin\' DESC, last_booking DESC, u.id DESC')->fetchAll();
    foreach ($users as &$user) {
        $user['is_demo'] = (bool) $user['is_demo'];
    }
    return $users;
}

function admin_set_role($admin, $id, $data)
{
    $role = choice_value($data, 'role', ['client', 'admin'], 'Неизвестная роль.');
    if ($id === (int) $admin['id']) {
        send_error(409, 'Свою роль менять нельзя: так можно случайно потерять доступ к админке.');
    }
    if (!query('SELECT id FROM users WHERE id = ?', [$id])->fetchColumn()) {
        send_error(404, 'Пользователь не найден.');
    }
    query('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
    return admin_list_clients();
}

// --- Настройки: посты, часы работы, марки ---
function admin_settings()
{
    return ['settings' => schedule_settings(), 'brands' => admin_list_brands()];
}

function admin_save_settings($data)
{
    $posts = int_value($data, 'posts', 1, 20);
    $open = int_value($data, 'open_hour', 0, 23);
    $close = int_value($data, 'close_hour', 1, 24);
    if ($close <= $open) {
        invalid('close_hour', 'Время закрытия должно быть позже открытия.');
    }
    foreach (['posts' => $posts, 'open_hour' => $open, 'close_hour' => $close] as $key => $value) {
        query('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [$key, (string) $value]);
    }
    return admin_settings();
}

function admin_list_brands()
{
    $brands = query('SELECT id, name, is_premium, sort FROM brands ORDER BY sort, name')->fetchAll();
    foreach ($brands as &$brand) {
        $brand['is_premium'] = (bool) $brand['is_premium'];
    }
    return $brands;
}

function admin_save_brand($data, $id = null)
{
    $name = text_value($data, 'name', 60);
    $premium = bool_value($data, 'is_premium');
    $sort = int_value($data, 'sort', 0, 1000);
    $same = query('SELECT id FROM brands WHERE name = ?', [$name])->fetchColumn();
    if ($same && (int) $same !== $id) {
        invalid('name', 'Такая марка уже есть.');
    }
    if ($id === null) {
        insert('INSERT INTO brands (name, is_premium, sort) VALUES (?, ?, ?)', [$name, $premium ? 1 : 0, $sort]);
    } else {
        $old = query('SELECT name FROM brands WHERE id = ?', [$id])->fetchColumn();
        if ($old === false) {
            send_error(404, 'Марка не найдена.');
        }
        query('UPDATE brands SET name = ?, is_premium = ?, sort = ? WHERE id = ?', [$name, $premium ? 1 : 0, $sort, $id]);
        // Машины в гаражах хранят марку названием: переименовали марку — обновим и их.
        query('UPDATE cars SET brand = ? WHERE brand = ?', [$name, $old]);
    }
    return admin_settings();
}

function admin_delete_brand($id)
{
    $name = query('SELECT name FROM brands WHERE id = ?', [$id])->fetchColumn();
    if ($name === false) {
        send_error(404, 'Марка не найдена.');
    }
    if (query('SELECT COUNT(*) FROM cars WHERE brand = ?', [$name])->fetchColumn() > 0) {
        send_error(409, 'Эта марка есть в гаражах клиентов. Её можно переименовать, но не удалить.');
    }
    // В прошлых записях марка хранится текстом, поэтому они не пострадают.
    query('DELETE FROM brands WHERE id = ?', [$id]);
    return admin_settings();
}
