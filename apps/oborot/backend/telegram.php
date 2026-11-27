<?php
// Уведомление о новой записи в Telegram. Необязательно: работает, только если заданы
// TELEGRAM_BOT_TOKEN (токен бота от @BotFather) и TELEGRAM_CHAT_ID (куда писать).
// Если Telegram недоступен, запись всё равно сохранена: ошибку только пишем в журнал.

function notify_new_booking($booking)
{
    $token = config('TELEGRAM_BOT_TOKEN');
    $chatId = config('TELEGRAM_CHAT_ID');
    if ($token === '' || $chatId === '') {
        return;
    }

    $services = implode(', ', array_column($booking['items'], 'name'));
    $start = new DateTimeImmutable($booking['starts_at']);
    $text = "Новая запись № {$booking['number']}\n"
        . $start->format('d.m.Y H:i') . ', ' . $booking['hours'] . " ч\n"
        . "{$booking['customer_name']}, {$booking['phone']}\n"
        . "{$booking['brand']}, {$booking['body_name']}\n"
        . "$services\n"
        . 'Итого: ' . number_format($booking['total'], 0, ',', ' ') . ' ₽';
    if ($booking['comment']) {
        $text .= "\nКомментарий: {$booking['comment']}";
    }

    // Ждём ответа Telegram не больше 3 секунд, чтобы клиент не ждал записи.
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode(['chat_id' => $chatId, 'text' => $text], JSON_UNESCAPED_UNICODE),
        'timeout' => 3,
        'ignore_errors' => true,
    ]]);
    try {
        $result = @file_get_contents("https://api.telegram.org/bot$token/sendMessage", false, $context);
        if ($result === false || !str_contains($result, '"ok":true')) {
            error_log('Telegram: не удалось отправить уведомление о записи ' . $booking['id']);
        }
    } catch (Throwable $error) {
        error_log('Telegram: ' . $error->getMessage());
    }
}
