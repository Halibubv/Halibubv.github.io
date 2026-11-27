<?php
// Часы работы кофейни и всё, что от них зависит: статус «открыто/закрыто»,
// свободное время для заказа с собой.
// День недели как в JavaScript и PHP date('w'): 0 — воскресенье, 1 — понедельник … 6 — суббота.

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Часы по дням недели: [0 => ['weekday' => 0, 'opens' => '09:00', 'closes' => '20:00'], ...].
// Выходной день — opens и closes равны null.
// Читаем из базы один раз за запрос; $reload = true — перечитать (после сохранения).
function opening_hours($reload = false)
{
    static $hours = null;
    if ($hours !== null && !$reload) {
        return $hours;
    }
    $hours = [];
    $rows = query("SELECT weekday, TIME_FORMAT(opens, '%H:%i') AS opens, TIME_FORMAT(closes, '%H:%i') AS closes
        FROM opening_hours ORDER BY weekday")->fetchAll();
    for ($day = 0; $day <= 6; $day++) {
        $hours[$day] = ['weekday' => $day, 'opens' => null, 'closes' => null];
    }
    foreach ($rows as $row) {
        $hours[(int) $row['weekday']] = ['weekday' => (int) $row['weekday'], 'opens' => $row['opens'], 'closes' => $row['closes']];
    }
    return $hours;
}

// Часы работы в конкретный день: ['opens' => DateTimeImmutable, 'closes' => DateTimeImmutable] или null, если выходной.
function hours_on($date)
{
    $day = new DateTimeImmutable($date);
    $hours = opening_hours()[(int) $day->format('w')];
    if ($hours['opens'] === null) {
        return null;
    }
    return [
        'opens' => new DateTimeImmutable($date . ' ' . $hours['opens']),
        'closes' => new DateTimeImmutable($date . ' ' . $hours['closes']),
    ];
}

// 8:00 вместо 08:00 — так привычнее читать.
function short_time($time)
{
    return ltrim(substr($time, 0, 1), '0') . substr($time, 1);
}

// Статус для лендинга: открыто ли сейчас и что написать.
function cafe_status()
{
    $now = new DateTimeImmutable();
    $today = hours_on($now->format('Y-m-d'));
    if ($today && $now >= $today['opens'] && $now < $today['closes']) {
        $until = short_time($today['closes']->format('H:i'));
        return ['open' => true, 'text' => "Сейчас открыто, до $until", 'short' => "Открыто до $until"];
    }
    if ($today && $now < $today['opens']) {
        $from = short_time($today['opens']->format('H:i'));
        return ['open' => false, 'text' => "Сейчас закрыто, откроемся в $from", 'short' => "Откроемся в $from"];
    }
    // Ищем ближайший рабочий день впереди.
    for ($k = 1; $k <= 7; $k++) {
        $day = $now->modify("+$k day");
        $hours = hours_on($day->format('Y-m-d'));
        if ($hours) {
            $from = short_time($hours['opens']->format('H:i'));
            $when = $k === 1 ? 'завтра' : 'в ' . mb_strtolower(WEEKDAY_SHORT[(int) $day->format('w')]);
            return ['open' => false, 'text' => "Сейчас закрыто, $when с $from", 'short' => ucfirst_ru($when) . " с $from"];
        }
    }
    return ['open' => false, 'text' => 'Сейчас закрыто', 'short' => 'Закрыто'];
}

function ucfirst_ru($text)
{
    return mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1);
}

// Время, к которому можно заказать с собой: сегодня и завтра, шаг 15 минут,
// не раньше чем через 15 минут от сейчас, от открытия до закрытия минус 15 минут
// (чтобы гость успел забрать заказ до закрытия).
function pickup_times()
{
    $now = new DateTimeImmutable();
    $earliest = $now->modify('+15 minutes');
    $times = [];
    for ($k = 0; $k <= 1; $k++) {
        $date = $now->modify("+$k day")->format('Y-m-d');
        $hours = hours_on($date);
        if (!$hours) {
            continue;
        }
        $last = $hours['closes']->modify('-15 minutes');
        for ($time = $hours['opens']; $time <= $last; $time = $time->modify('+15 minutes')) {
            if ($time >= $earliest) {
                $times[] = $time->format('Y-m-d H:i');
            }
        }
    }
    return $times;
}

// --- Админка: часы работы ---

function save_hours($data)
{
    $days = $data['days'] ?? null;
    if (!is_array($days) || count($days) !== 7) {
        invalid('days', 'Нужны часы на все семь дней недели.');
    }
    $rows = [];
    foreach ($days as $day) {
        if (!is_array($day)) {
            invalid('days', 'Неверные данные.');
        }
        $weekday = int_value($day, 'weekday', 0, 6);
        if (!empty($day['closed'])) {
            $rows[$weekday] = [null, null];
            continue;
        }
        $opens = time_value($day, 'opens');
        $closes = time_value($day, 'closes');
        if ($closes <= $opens) {
            invalid('days', WEEKDAY_SHORT[$weekday] . ': время закрытия должно быть позже открытия.');
        }
        $rows[$weekday] = [$opens, $closes];
    }
    if (count($rows) !== 7) {
        invalid('days', 'Нужны часы на все семь дней недели.');
    }
    transaction(function () use ($rows) {
        foreach ($rows as $weekday => [$opens, $closes]) {
            query('INSERT INTO opening_hours (weekday, opens, closes) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE opens = VALUES(opens), closes = VALUES(closes)', [$weekday, $opens, $closes]);
        }
    });
    opening_hours(true);
}
