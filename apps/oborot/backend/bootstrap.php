<?php
// Подготовка каждого запроса: подключаем все файлы бэкенда, запускаем сессию
// и задаём, что ответить, если в коде случилась непредвиденная ошибка.
require __DIR__ . '/config.php';
require __DIR__ . '/http.php';
require __DIR__ . '/database.php';
require __DIR__ . '/validation.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/catalog.php';
require __DIR__ . '/slots.php';
require __DIR__ . '/bookings.php';
require __DIR__ . '/garage.php';
require __DIR__ . '/profile.php';
require __DIR__ . '/admin.php';
require __DIR__ . '/telegram.php';

date_default_timezone_set('Europe/Moscow');
ini_set('display_errors', '0'); // не показывать посетителю текст ошибок PHP

// Cookie сессии: httponly — недоступна JavaScript, samesite=Lax — браузер не отправит её
// с запросом на изменение данных с чужого сайта. secure — только по HTTPS
// (на своём компьютере без HTTPS в .env ставится SESSION_SECURE=0).
session_name('oborot_session');
session_set_cookie_params([
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => config('SESSION_SECURE', '1') === '1',
]);
session_start();

// Если где-то в коде ошибка (например, база недоступна), подробности пишем в журнал
// сервера, а пользователю отвечаем общим текстом.
function handle_error($error)
{
    error_log((string) $error);
    respond(['error' => 'Не удалось выполнить действие. Повторите попытку позже.'], 500);
}
set_exception_handler('handle_error');
