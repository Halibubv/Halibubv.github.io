<?php
// Демо-данные: меню, столики, часы, два демо-аккаунта (гость и администратор)
// и брони с заказами на прошлую неделю, сегодня и ближайшие дни. Все люди и телефоны вымышленные.
// Запускать после миграций, только из консоли:
//   php database/seed-demo.php               — пересоздать демо (все брони и заказы удаляются!)
//   php database/seed-demo.php --if-missing  — создать, только если демо-аккаунта ещё нет
// Работает только на демо (DEMO_MODE=1) или на своём компьютере (APP_ENV=development):
// пароли демо-аккаунтов известны всем, в настоящей кофейне их быть не должно.
require dirname(__DIR__) . '/backend/config.php';
require dirname(__DIR__) . '/backend/http.php';
require dirname(__DIR__) . '/backend/database.php';
require dirname(__DIR__) . '/backend/validation.php';
require dirname(__DIR__) . '/backend/users.php';
require dirname(__DIR__) . '/backend/notify.php';
require dirname(__DIR__) . '/backend/hours.php';
require dirname(__DIR__) . '/backend/menu.php';
require dirname(__DIR__) . '/backend/reservations.php';
require dirname(__DIR__) . '/backend/orders.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}
// Тот же часовой пояс, что в backend/bootstrap.php, чтобы «сегодня» совпадало с приложением.
date_default_timezone_set('Europe/Moscow');

if (!demo_mode() && config('APP_ENV') !== 'development') {
    fwrite(STDERR, "Demo data is only for DEMO_MODE=1 or APP_ENV=development.\n");
    exit(1);
}

$onlyIfMissing = in_array('--if-missing', $argv, true);
$clientEmail = DEMO_ACCOUNTS[0]['email'];
if ($onlyIfMissing && query('SELECT id FROM users WHERE email = ?', [$clientEmail])->fetchColumn()) {
    echo "Demo data already exists.\n";
    exit(0);
}

// Одинаковые «случайные» данные при каждом запуске.
mt_srand(2026);
$now = new DateTimeImmutable();

// Время начала брони в день $date без учёта «сейчас» (для прошлых броней тоже).
function demo_times($date)
{
    $hours = hours_on($date);
    if (!$hours) {
        return [];
    }
    $times = [];
    for ($time = $hours['opens']; $time <= $hours['closes']->modify('-90 minutes'); $time = $time->modify('+30 minutes')) {
        $times[] = $time->format('H:i');
    }
    return $times;
}

// Бронь на свободный столик. Статус зависит от того, прошло ли уже это время.
function demo_reservation($date, $time, $guests, $name, $phone, $comment, $userId, $adminId, $futureStatus = 'confirmed', $pastStatus = 'closed')
{
    $start = "$date $time:00";
    $end = date('Y-m-d H:i:s', strtotime($start) + RESERVATION_HOURS * 3600);
    $table = find_free_table($guests, $start, $end);
    if (!$table) {
        return;
    }
    $nowText = date('Y-m-d H:i:s');
    $status = $futureStatus;
    if ($end <= $nowText) {
        $status = $pastStatus;
    } elseif ($start <= $nowText) {
        $status = 'seated';
    }
    $created = date('Y-m-d H:i:s', min(time(), strtotime($start) - 86400));
    $id = insert('INSERT INTO reservations (user_id, table_id, starts_at, ends_at, guests, customer_name, phone, comment, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$userId, $table['id'], $start, $end, $guests, $name, $phone, $comment, $status, $created]);
    log_status('reservation', $id, 'new', $userId);
    if ($status !== 'new') {
        log_status('reservation', $id, $status, $adminId);
    }
}

// Заказ из случайных позиций меню (кроме стоп-листа).
function demo_order($readyAt, $status, $name, $phone, $userId, $adminId, $comment = null)
{
    $items = query('SELECT id, name, price FROM menu_items WHERE is_available = 1 AND is_hidden = 0')->fetchAll();
    $lines = [];
    $count = mt_rand(1, 3);
    for ($k = 0; $k < $count; $k++) {
        $item = $items[mt_rand(0, count($items) - 1)];
        $lines[$item['id']] = ['item' => $item, 'qty' => ($lines[$item['id']]['qty'] ?? 0) + mt_rand(1, 2)];
    }
    $total = 0;
    foreach ($lines as $line) {
        $total += $line['item']['price'] * $line['qty'];
    }
    $created = date('Y-m-d H:i:s', min(time(), strtotime($readyAt) - 25 * 60));
    $id = insert('INSERT INTO orders (user_id, customer_name, phone, comment, ready_at, total, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$userId, $name, $phone, $comment, $readyAt . ':00', $total, $status, $created]);
    foreach ($lines as $line) {
        query('INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)',
            [$id, $line['item']['id'], $line['item']['name'], $line['item']['price'], $line['qty']]);
    }
    log_status('order', $id, 'new', $userId);
    if ($status !== 'new') {
        log_status('order', $id, $status, $adminId);
    }
}

$guests = [
    ['Ольга', '+7 (900) 000-11-01'], ['Дмитрий', '+7 (900) 000-11-02'], ['Марина', '+7 (900) 000-11-03'],
    ['Илья', '+7 (900) 000-11-04'], ['Света и Костя', '+7 (900) 000-11-05'], ['Артём', '+7 (900) 000-11-06'],
    ['Наталья', '+7 (900) 000-11-07'], ['Кирилл', '+7 (900) 000-11-08'], ['Вера', '+7 (900) 000-11-09'],
];
$wishes = [null, null, 'Если можно, в тихом углу', 'Будем с ребёнком, нужен детский стул', null, 'День рождения подруги', null, 'Работаем с ноутбуком, нужна розетка'];

$db = database();
$db->beginTransaction();

// 1. Чистим всё, что пересоздаём. Порядок важен из-за внешних ключей.
foreach (['status_events', 'order_items', 'orders', 'reservations', 'menu_items', 'cafe_tables', 'opening_hours', 'categories', 'login_attempts'] as $table) {
    $db->exec("DELETE FROM $table");
}
$emails = array_column(DEMO_ACCOUNTS, 'email');
query('DELETE FROM users WHERE email IN (?, ?)', $emails);

// 2. Меню, столики и часы — из того же файла, что и при первой миграции.
foreach (sql_statements(__DIR__ . '/002-cafe-data.sql') as $statement) {
    $db->exec($statement);
}
opening_hours(true);
// Одна позиция в стоп-листе, чтобы было видно, как это выглядит на сайте.
query("UPDATE menu_items SET is_available = 0 WHERE name = 'Миндальный круассан'");

// 3. Демо-аккаунты.
$ids = [];
foreach (DEMO_ACCOUNTS as $account) {
    $ids[$account['role']] = insert('INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)',
        [$account['email'], password_hash($account['password'], PASSWORD_BCRYPT), $account['name'], $account['phone'], $account['role']]);
}
$clientId = $ids['client'];
$adminId = $ids['admin'];
$client = DEMO_ACCOUNTS[0];

// 4. Брони: прошлая неделя (завершены), сегодня и следующие 5 дней.
for ($offset = -6; $offset <= 5; $offset++) {
    $date = $now->modify("$offset day")->format('Y-m-d');
    $times = demo_times($date);
    if (!$times) {
        continue;
    }
    $count = $offset === 0 ? 6 : ($offset < 0 ? 3 : mt_rand(2, 4));
    for ($k = 0; $k < $count; $k++) {
        [$name, $phone] = $guests[mt_rand(0, count($guests) - 1)];
        $time = $times[(int) floor(($k + 0.5) * count($times) / $count)];
        $future = $offset > 0 && $k % 2 === 0 ? 'new' : 'confirmed';
        $past = mt_rand(0, 9) === 0 ? 'no_show' : 'closed';
        demo_reservation($date, $time, mt_rand(1, 5), $name, $phone, $wishes[mt_rand(0, count($wishes) - 1)], null, $adminId, $future, $past);
    }
}
// Брони демо-гостя: одна прошедшая и две впереди.
$past = $now->modify('-3 day')->format('Y-m-d');
$pastTimes = demo_times($past);
if ($pastTimes) {
    demo_reservation($past, $pastTimes[intdiv(count($pastTimes), 2)], 2, $client['name'], $client['phone'], null, $clientId, $adminId);
}
foreach ([[1, 'confirmed', 'Будем втроём, принесём торт'], [3, 'new', null]] as [$offset, $status, $comment]) {
    $date = $now->modify("+$offset day")->format('Y-m-d');
    $times = demo_times($date);
    if ($times) {
        demo_reservation($date, $times[count($times) - 3], 3, $client['name'], $client['phone'], $comment, $clientId, $adminId, $status);
    }
}

// 5. Заказы с собой: выданные за прошлую неделю — для выручки.
for ($offset = -6; $offset <= 0; $offset++) {
    $date = $now->modify("$offset day")->format('Y-m-d');
    $hours = hours_on($date);
    if (!$hours) {
        continue;
    }
    for ($k = 0; $k < 4; $k++) {
        $openMinutes = intdiv($hours['closes']->getTimestamp() - $hours['opens']->getTimestamp(), 60) - 30;
        $minutes = mt_rand(0, intdiv($openMinutes, 15)) * 15;
        $readyAt = $hours['opens']->modify("+$minutes minutes")->format('Y-m-d H:i');
        if ($readyAt > $now->modify('-30 minutes')->format('Y-m-d H:i')) {
            continue; // сегодняшние после «сейчас» — это активные заказы ниже
        }
        [$name, $phone] = $guests[mt_rand(0, count($guests) - 1)];
        demo_order($readyAt, mt_rand(0, 7) === 0 ? 'cancelled' : 'issued', $name, $phone, null, $adminId);
    }
}
$twoDaysAgo = $now->modify('-2 day')->format('Y-m-d');
if ($hours = hours_on($twoDaysAgo)) {
    demo_order($hours['opens']->modify('+90 minutes')->format('Y-m-d H:i'), 'issued', $client['name'], $client['phone'], $clientId, $adminId);
}
// Пара выданных заказов сегодня утром, чтобы «выручка сегодня» на экране «Сегодня» не была нулевой.
if (($hours = hours_on($now->format('Y-m-d'))) && $hours['opens']->modify('+45 minutes') < $now) {
    foreach (['+15 minutes', '+45 minutes'] as $shift) {
        [$name, $phone] = $guests[mt_rand(0, count($guests) - 1)];
        demo_order($hours['opens']->modify($shift)->format('Y-m-d H:i'), 'issued', $name, $phone, null, $adminId);
    }
}

// Активные заказы: к ближайшему времени, когда можно забрать (сегодня или завтра).
$pickup = pickup_times();
$active = [['new', 'Без сахара, пожалуйста'], ['new', null], ['accepted', null], ['ready', null]];
foreach ($active as $k => [$status, $comment]) {
    if (!isset($pickup[$k * 2])) {
        break;
    }
    [$name, $phone] = $guests[mt_rand(0, count($guests) - 1)];
    demo_order($pickup[$k * 2], $status, $name, $phone, null, $adminId, $comment);
}
if (isset($pickup[3])) {
    demo_order($pickup[3], 'accepted', $client['name'], $client['phone'], $clientId, $adminId);
}

$db->commit();
echo "Demo data is ready.\n";
foreach (DEMO_ACCOUNTS as $account) {
    echo "  {$account['role']}: {$account['email']} / {$account['password']}\n";
}
