<?php
// Расписание: сколько постов занято в каждый час дня и какие слоты свободны.
// Запись занимает один пост на всю длительность работ. Одновременно записей
// не может быть больше, чем постов (настройка posts).

// Статусы, при которых запись занимает пост. Отменённая и «не приехал» место не держат.
const ACTIVE_STATUSES = ['new', 'confirmed', 'in_work', 'done'];

// Сколько постов занято в каждый час дня: [9 => 2, 10 => 3, ...].
// Записи начинаются и заканчиваются ровно в начале часа, поэтому достаточно посчитать по часам.
function hour_load($date, $exceptBookingId = 0)
{
    $settings = schedule_settings();
    $load = array_fill($settings['open_hour'], max(1, $settings['close_hour'] - $settings['open_hour']), 0);
    $placeholders = implode(',', array_fill(0, count(ACTIVE_STATUSES), '?'));
    $bookings = query("SELECT starts_at, ends_at FROM bookings
        WHERE starts_at < ? AND ends_at > ? AND status IN ($placeholders) AND id <> ?",
        array_merge([date('Y-m-d', strtotime("$date +1 day")), "$date 00:00:00"], ACTIVE_STATUSES, [$exceptBookingId]))->fetchAll();

    foreach ($bookings as $booking) {
        $start = new DateTimeImmutable($booking['starts_at']);
        $end = new DateTimeImmutable($booking['ends_at']);
        foreach (array_keys($load) as $hour) {
            $hourStart = new DateTimeImmutable("$date $hour:00");
            $hourEnd = $hourStart->modify('+1 hour');
            if ($start < $hourEnd && $end > $hourStart) {
                $load[$hour]++;
            }
        }
    }
    return $load;
}

// Свободных постов на всё время работ: от $startHour на $hours часов.
// 0 — слот занят или работа не успеет закончиться до закрытия.
function free_posts($load, $startHour, $hours, $settings)
{
    if ($startHour < $settings['open_hour'] || $startHour + $hours > $settings['close_hour']) {
        return 0;
    }
    $free = $settings['posts'];
    for ($hour = $startHour; $hour < $startHour + $hours; $hour++) {
        $free = min($free, $settings['posts'] - ($load[$hour] ?? 0));
    }
    return max(0, $free);
}

// Можно ли записаться на эту дату: сегодня и ещё 13 дней вперёд.
function bookable_date($date)
{
    $today = date('Y-m-d');
    $last = date('Y-m-d', strtotime('+' . (BOOKING_DAYS - 1) . ' days'));
    return $date >= $today && $date <= $last;
}

// Слоты дня для GET /api/slots: каждый час с открытия до последнего часа перед закрытием.
// Слот недоступен, если время уже прошло, работа не успеет до закрытия
// или на всё время работ нет свободного поста.
function day_slots($date, $hours)
{
    $settings = schedule_settings();
    $load = hour_load($date);
    $now = new DateTimeImmutable();
    $slots = [];
    for ($hour = $settings['open_hour']; $hour < $settings['close_hour']; $hour++) {
        $start = new DateTimeImmutable("$date $hour:00");
        $free = $start > $now ? free_posts($load, $hour, $hours, $settings) : 0;
        $reason = null;
        if ($start <= $now) {
            $reason = 'past';
        } elseif ($hour + $hours > $settings['close_hour']) {
            $reason = 'closing';
        } elseif ($free === 0) {
            $reason = 'busy';
        }
        $slots[] = [
            'time' => sprintf('%02d:00', $hour),
            'available' => $free > 0,
            'free_posts' => $free,
            'reason' => $reason,
        ];
    }
    return [
        'date' => $date,
        'hours' => $hours,
        'bookable' => bookable_date($date),
        'fits_day' => $hours <= $settings['close_hour'] - $settings['open_hour'],
        'slots' => bookable_date($date) ? $slots : [],
    ];
}
