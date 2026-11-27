<?php
// Ответы сервера браузеру и чтение данных, которые прислал браузер.
// Браузер и сервер общаются в формате JSON: {"name": "Алексей", "phone": "+7 (999) 123-45-67"}.

// Отправить ответ в формате JSON и закончить работу скрипта (exit).
function respond($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Отправить ошибку. $status — код ответа: 401 не вошёл, 403 нет прав, 404 не найдено,
// 409 конфликт (время заняли), 422 ошибка в форме. $fields — тексты ошибок для полей формы.
function send_error($status, $message, $fields = [])
{
    respond(['error' => $message, 'fields' => (object) $fields], $status);
}

// Запрос на изменение (POST, PUT, DELETE) принимаем только в формате JSON.
// Обычная HTML-форма с чужого сайта так отправить не умеет, а fetch с чужого сайта
// с таким заголовком браузер без разрешения сервера не пошлёт. Вместе с SameSite=Lax
// у cookie это защита от подделки запросов (CSRF).
function require_json_request()
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (!str_starts_with($contentType, 'application/json')) {
        send_error(415, 'Отправьте данные в формате JSON.');
    }
}

// Данные из тела запроса (то, что браузер отправил в body) в виде массива PHP.
function read_json()
{
    require_json_request();

    $body = file_get_contents('php://input');
    if (strlen($body) > 256 * 1024) {
        send_error(413, 'Слишком большой запрос.');
    }
    // Пустое тело (например, у кнопки «Отменить запись») — это пустой объект.
    if (trim($body) === '') {
        return [];
    }

    // true — получить обычный массив, а не объект.
    $data = json_decode($body, true);
    if (!is_array($data)) {
        send_error(400, 'Некорректный JSON.');
    }
    return $data;
}
