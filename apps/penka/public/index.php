<?php
// Точка входа: сюда приходит каждый запрос, кроме готовых файлов (картинки, стили, скрипты).
// Ниже — список маршрутов: метод (GET, POST, PUT, DELETE) + адрес → что сделать.
// Подходящий маршрут отправляет ответ через respond(), и на этом скрипт заканчивается.
require __DIR__ . '/../backend/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// --- Страницы сайта ---
// Главная — статичный лендинг public/index.html.
// Вход, кабинет и админку рисует React: на любой их адрес отдаём один и тот же
// собранный файл ui/index.html, а React сам смотрит на адрес и показывает нужный экран.
function send_html($file, $status = 200)
{
    if (!is_file($file)) {
        send_error(503, 'Интерфейс ещё не собран. Выполните npm run build.');
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    readfile($file);
    exit;
}

if ($method === 'GET' && $path === '/') {
    send_html(__DIR__ . '/index.html');
}
if ($method === 'GET' && preg_match('#^/(login|register|account|admin)(/[a-z-]*)?/?$#', $path)) {
    send_html(__DIR__ . '/ui/index.html');
}

// Проверка для хостинга Render: сервер работает и база отвечает.
if ($method === 'GET' && $path === '/api/health') {
    query('SELECT 1');
    respond(['status' => 'ok']);
}

// --- Публичное API для лендинга ---
if ($method === 'GET' && $path === '/api/menu') {
    respond(['categories' => menu()]);
}
if ($method === 'GET' && $path === '/api/hours') {
    respond(['days' => array_values(opening_hours()), 'today' => (int) date('w'), 'status' => cafe_status()]);
}
if ($method === 'GET' && $path === '/api/slots') {
    respond(reservation_slots($_GET));
}
if ($method === 'GET' && $path === '/api/pickup-times') {
    respond(['times' => pickup_times()]);
}
if ($method === 'POST' && $path === '/api/reservations') {
    respond(['reservation' => create_reservation(read_json(), current_user())], 201);
}
if ($method === 'POST' && $path === '/api/orders') {
    respond(['order' => create_order(read_json(), current_user())], 201);
}

// --- Вход и регистрация ---
// demo — включён ли демо-режим, demo_logins — логины для страницы входа (только на демо).
if ($method === 'GET' && $path === '/api/session') {
    respond(['user' => current_user(), 'demo' => demo_mode(), 'demo_logins' => demo_logins()]);
}
if ($method === 'POST' && $path === '/api/auth/register') {
    respond(['user' => register(read_json())], 201);
}
if ($method === 'POST' && $path === '/api/auth/login') {
    respond(['user' => login(read_json())]);
}
if ($method === 'POST' && $path === '/api/auth/logout') {
    logout();
    respond(['user' => null]);
}

// --- Личный кабинет: только свои брони, заказы и профиль ---
if ($method === 'GET' && $path === '/api/account/reservations') {
    $user = require_user();
    respond(['reservations' => user_reservations($user['id'])]);
}
if ($method === 'POST' && preg_match('#^/api/account/reservations/(\d+)/cancel$#', $path, $match)) {
    $user = require_user();
    cancel_own_reservation((int) $match[1], $user);
    respond(['reservations' => user_reservations($user['id'])]);
}
if ($method === 'GET' && $path === '/api/account/orders') {
    $user = require_user();
    respond(['orders' => user_orders($user['id'])]);
}
if ($method === 'PUT' && $path === '/api/account/profile') {
    $user = require_user();
    // На демо одним аккаунтом пользуются все: его имя и пароль не меняем.
    if (demo_mode() && is_demo_account($user)) {
        send_error(403, 'Это общий демо-аккаунт: профиль у него менять нельзя. Зарегистрируйтесь, чтобы попробовать.');
    }
    update_profile($user['id'], read_json());
    respond(['user' => current_user()]);
}
if ($method === 'PUT' && $path === '/api/account/password') {
    $user = require_user();
    if (demo_mode() && is_demo_account($user)) {
        send_error(403, 'Это общий демо-аккаунт: пароль у него менять нельзя. Зарегистрируйтесь, чтобы попробовать.');
    }
    change_password($user['id'], read_json());
    respond(['changed' => true]);
}

// --- Админка ---
// Всё, что начинается с /api/admin/, — только для администратора.
if (str_starts_with($path, '/api/admin/')) {
    $admin = require_admin();
}

// Демо-режим: пароль администратора написан на странице входа, поэтому на публичном
// демо можно двигать заказы и брони по статусам, пересаживать гостей и вести стоп-лист,
// а цены, состав меню, столики, часы работы и роли менять нельзя.
$demoAllowed = [
    '#^/api/admin/orders/\d+/status$#',
    '#^/api/admin/reservations/\d+/(status|table)$#',
    '#^/api/admin/menu/\d+/availability$#',
];
if (demo_mode() && str_starts_with($path, '/api/admin/') && $method !== 'GET') {
    $allowed = false;
    foreach ($demoAllowed as $pattern) {
        $allowed = $allowed || preg_match($pattern, $path);
    }
    if (!$allowed) {
        send_error(403, 'Это демо: можно менять статусы заказов и броней и вести стоп-лист, а цены, меню, столики, часы и роли — нельзя.');
    }
}

if ($method === 'GET' && $path === '/api/admin/today') {
    respond(admin_today());
}

// Заказы
if ($method === 'GET' && $path === '/api/admin/orders') {
    respond(['orders' => admin_orders()]);
}
if ($method === 'POST' && preg_match('#^/api/admin/orders/(\d+)/status$#', $path, $match)) {
    respond(['order' => set_order_status((int) $match[1], read_json(), $admin)]);
}

// Брони
if ($method === 'GET' && $path === '/api/admin/reservations') {
    $date = isset($_GET['date']) ? date_value($_GET, 'date') : date('Y-m-d');
    respond(['date' => $date, 'reservations' => admin_reservations($date)]);
}
if ($method === 'POST' && preg_match('#^/api/admin/reservations/(\d+)/status$#', $path, $match)) {
    respond(['reservation' => set_reservation_status((int) $match[1], read_json(), $admin)]);
}
if ($method === 'GET' && preg_match('#^/api/admin/reservations/(\d+)/free-tables$#', $path, $match)) {
    respond(['tables' => free_tables_for((int) $match[1])]);
}
if ($method === 'POST' && preg_match('#^/api/admin/reservations/(\d+)/table$#', $path, $match)) {
    respond(['reservation' => move_reservation((int) $match[1], read_json(), $admin)]);
}

// Меню
if ($method === 'GET' && $path === '/api/admin/menu') {
    respond(['categories' => menu(true), 'icons' => MENU_ICONS, 'tags' => MENU_TAGS]);
}
if ($method === 'POST' && $path === '/api/admin/menu') {
    respond(['item' => save_menu_item(read_json())], 201);
}
if ($method === 'PUT' && preg_match('#^/api/admin/menu/(\d+)$#', $path, $match)) {
    respond(['item' => save_menu_item(read_json(), (int) $match[1])]);
}
if ($method === 'DELETE' && preg_match('#^/api/admin/menu/(\d+)$#', $path, $match)) {
    delete_menu_item((int) $match[1]);
    respond(['deleted' => true]);
}
if ($method === 'POST' && preg_match('#^/api/admin/menu/(\d+)/availability$#', $path, $match)) {
    respond(['item' => set_menu_item_available((int) $match[1], read_json())]);
}

// Столики
if ($method === 'GET' && $path === '/api/admin/tables') {
    respond(['tables' => list_tables()]);
}
if ($method === 'POST' && $path === '/api/admin/tables') {
    save_table(read_json());
    respond(['tables' => list_tables()], 201);
}
if ($method === 'PUT' && preg_match('#^/api/admin/tables/(\d+)$#', $path, $match)) {
    save_table(read_json(), (int) $match[1]);
    respond(['tables' => list_tables()]);
}

// Часы работы
if ($method === 'PUT' && $path === '/api/admin/hours') {
    save_hours(read_json());
    respond(['days' => array_values(opening_hours())]);
}

// Пользователи и роли
if ($method === 'GET' && $path === '/api/admin/users') {
    respond(['users' => admin_users()]);
}
if ($method === 'PUT' && preg_match('#^/api/admin/users/(\d+)$#', $path, $match)) {
    set_user_role($admin, (int) $match[1], read_json());
    respond(['users' => admin_users()]);
}

// --- Ни один маршрут не подошёл ---
// Для адреса страницы показываем экран «не найдено» из React, для адреса API — ошибку в JSON.
if ($method === 'GET' && !str_starts_with($path, '/api/')) {
    send_html(__DIR__ . '/ui/index.html', 404);
}
send_error(404, 'Страница не найдена.');
