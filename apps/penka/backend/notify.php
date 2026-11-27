<?php
// Уведомления в Telegram о новой брони и новом заказе. Необязательные:
// без TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID функция просто ничего не делает.
// Если Telegram не ответил за 3 секунды или вернул ошибку, пишем это в журнал
// сервера, а бронь или заказ всё равно сохранены — гость ошибки не увидит.

function notify_telegram($text)
{
    $token = config('TELEGRAM_BOT_TOKEN');
    $chatId = config('TELEGRAM_CHAT_ID');
    if ($token === '' || $chatId === '') {
        return;
    }

    // Обычный HTTP-запрос средствами PHP, без расширения curl.
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => json_encode(['chat_id' => $chatId, 'text' => $text], JSON_UNESCAPED_UNICODE),
            'timeout' => 3,
            'ignore_errors' => true, // чтобы прочитать ответ и при коде ошибки
        ],
    ]);
    try {
        $answer = @file_get_contents('https://api.telegram.org/bot' . $token . '/sendMessage', false, $context);
        if ($answer === false || !str_contains($answer, '"ok":true')) {
            error_log('Telegram notification failed');
        }
    } catch (Throwable $error) {
        error_log('Telegram notification failed: ' . $error->getMessage());
    }
}
