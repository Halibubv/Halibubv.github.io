<?php
// Точка входа: сюда приходит каждый запрос, кроме готовых файлов (картинки, стили, скрипты).
// Ниже — список маршрутов: метод (GET, POST, PUT, DELETE) + адрес → что сделать.
// Подходящий маршрут отправляет ответ через respond(), и на этом скрипт заканчивается.
require __DIR__ . '/../backend/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Все запросы на изменение — только JSON, иначе 415 (см. require_json_request в http.php).
if (!in_array($method, ['GET', 'HEAD'], true)) {
    require_json_request();
}

// --- Страницы сайта ---
// Главная — лендинг, обычный HTML-файл public/index.html.
if ($method === 'GET' && ($path === '/' || $path === '/index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    exit;
}

// Кабинет и админку рисует React, поэтому на любой их адрес отдаём один и тот же
// собранный файл ui/index.html, а React уже сам смотрит на адрес и показывает нужный экран.
function send_page($status = 200)
{
    $file = __DIR__ . '/ui/index.html';
    if (!is_file($file)) {
        send_error(503, 'Интерфейс ещё не собран. Выполните npm run build.');
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    readfile($file);
    exit;
}

$isPage = in_array($path, ['/login', '/register'], true)
    || preg_match('#^/account(/(garage|profile))?/?$#', $path)
    || preg_match('#^/admin(/(bookings|schedule|services|clients|settings))?/?$#', $path)
    || preg_match('#^/admin/bookings/\d+$#', $path);
if ($method === 'GET' && $isPage) {
    send_page();
}

// Проверка для хостинга Render: сервер работает и база отвечает.
if ($method === 'GET' && $path === '/api/health') {
    query('SELECT 1');
    respond(['status' => 'ok']);
}

// --- Вход и регистрация ---
// demo — включён ли демо-режим: тогда страница входа показывает демо-логины.
if ($method === 'GET' && $path === '/api/session') {
    respond(['user' => current_user(), 'demo' => demo_mode()]);
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

// --- Публичная часть: прайс, свободное время, запись ---
if ($method === 'GET' && $path === '/api/catalog') {
    respond(public_catalog());
}
// /api/slots?date=2026-11-28&hours=3 — свободные слоты дня для работ на 3 часа.
if ($method === 'GET' && $path === '/api/slots') {
    $date = date_value($_GET, 'date');
    $hours = int_value($_GET + ['hours' => '1'], 'hours', 1, 24);
    respond(day_slots($date, $hours));
}
if ($method === 'POST' && $path === '/api/bookings') {
    respond(['booking' => create_booking(current_user(), read_json())], 201);
}

// --- Кабинет клиента ---
if ($method === 'GET' && $path === '/api/account/bookings') {
    $user = require_user();
    respond(['bookings' => list_my_bookings($user['id'])]);
}
if ($method === 'POST' && preg_match('#^/api/account/bookings/(\d+)/cancel$#', $path, $match)) {
    $user = require_user();
    read_json();
    respond(['booking' => cancel_my_booking($user['id'], (int) $match[1])]);
}
if ($method === 'GET' && $path === '/api/account/cars') {
    $user = require_user();
    respond(['cars' => list_cars($user['id'])]);
}
if ($method === 'POST' && $path === '/api/account/cars') {
    $user = require_user();
    respond(['cars' => save_car($user['id'], read_json())], 201);
}
// Адрес с номером: /api/account/cars/5. preg_match кладёт найденный номер в $match[1].
if (preg_match('#^/api/account/cars/(\d+)$#', $path, $match)) {
    $user = require_user();
    $id = (int) $match[1];
    if ($method === 'PUT') {
        respond(['cars' => save_car($user['id'], read_json(), $id)]);
    }
    if ($method === 'DELETE') {
        delete_car($user['id'], $id);
        respond(['cars' => list_cars($user['id'])]);
    }
}
if ($method === 'PUT' && $path === '/api/profile') {
    $user = require_user();
    update_profile($user['id'], read_json());
    respond(['user' => current_user()]);
}
if ($method === 'PUT' && $path === '/api/profile/password') {
    $user = require_user();
    change_password($user['id'], read_json());
    respond(['changed' => true]);
}

// --- Админка ---
// Все адреса /api/admin/... — только для администратора (401 гостю, 403 клиенту).
if (str_starts_with($path, '/api/admin/')) {
    $admin = require_admin();

    // Демо-режим: пароль администратора написан на странице входа, его знают все.
    // Поэтому на демо можно менять только статусы записей (это безопасно и сбрасывается
    // при перезапуске), а прайс, марки, настройки и роли — нельзя.
    $isStatusChange = $method === 'PUT' && preg_match('#^/api/admin/bookings/\d+/status$#', $path);
    if (demo_mode() && $method !== 'GET' && !$isStatusChange) {
        send_error(403, 'Это демо: здесь можно менять статусы записей, а прайс, марки, настройки и роли — нет.');
    }
}

if ($method === 'GET' && $path === '/api/admin/summary') {
    respond(admin_summary());
}
if ($method === 'GET' && $path === '/api/admin/bookings') {
    respond(['bookings' => admin_list_bookings($_GET)]);
}
if ($method === 'GET' && preg_match('#^/api/admin/bookings/(\d+)$#', $path, $match)) {
    respond(['booking' => admin_find_booking((int) $match[1])]);
}
if ($method === 'PUT' && preg_match('#^/api/admin/bookings/(\d+)/status$#', $path, $match)) {
    respond(['booking' => admin_set_status($admin, (int) $match[1], read_json())]);
}
if ($method === 'GET' && $path === '/api/admin/schedule') {
    respond(admin_schedule(date_value($_GET + ['date' => date('Y-m-d')], 'date')));
}

if ($method === 'GET' && $path === '/api/admin/services') {
    respond(['services' => admin_list_services()]);
}
if ($method === 'POST' && $path === '/api/admin/services') {
    respond(['services' => admin_save_service(read_json())], 201);
}
if (preg_match('#^/api/admin/services/(\d+)$#', $path, $match)) {
    if ($method === 'PUT') {
        respond(['services' => admin_save_service(read_json(), (int) $match[1])]);
    }
    if ($method === 'DELETE') {
        respond(['services' => admin_delete_service((int) $match[1])]);
    }
}

if ($method === 'GET' && $path === '/api/admin/clients') {
    respond(['clients' => admin_list_clients()]);
}
if ($method === 'PUT' && preg_match('#^/api/admin/clients/(\d+)/role$#', $path, $match)) {
    respond(['clients' => admin_set_role($admin, (int) $match[1], read_json())]);
}

if ($method === 'GET' && $path === '/api/admin/settings') {
    respond(admin_settings());
}
if ($method === 'PUT' && $path === '/api/admin/settings') {
    respond(admin_save_settings(read_json()));
}
if ($method === 'POST' && $path === '/api/admin/brands') {
    respond(admin_save_brand(read_json()), 201);
}
if (preg_match('#^/api/admin/brands/(\d+)$#', $path, $match)) {
    if ($method === 'PUT') {
        respond(admin_save_brand(read_json(), (int) $match[1]));
    }
    if ($method === 'DELETE') {
        respond(admin_delete_brand((int) $match[1]));
    }
}

// --- Ни один маршрут не подошёл ---
// Для адреса страницы кабинета отдаём React с кодом 404: он сам покажет «Страница не найдена».
// Для адреса API — ошибку в JSON.
if ($method === 'GET' && preg_match('#^/(account|admin)/#', $path)) {
    send_page(404);
}
send_error(404, 'Страница не найдена.');
