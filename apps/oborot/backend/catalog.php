<?php
// Прайс и правила расчёта цены. Те же правила, что в калькуляторе на лендинге
// (public/index.html, функция calc), но цифрам из браузера сервер не доверяет и считает сам.

// Типы кузова и коэффициенты цены.
const BODIES = [
    'sedan' => ['name' => 'Седан / хэтчбек', 'k' => 1],
    'cross' => ['name' => 'Кроссовер', 'k' => 1.2],
    'suv' => ['name' => 'Внедорожник / минивэн', 'k' => 1.4],
];
const PREMIUM_K = 1.15;       // премиум-марка дороже на 15 %
const DISCOUNT_FROM = 3;      // скидка от трёх услуг
const DISCOUNT_RATE = 0.1;    // 10 %
const HOURS_K = 1.15;         // кроссовер и внедорожник — работы на 15 % дольше
const BOOKING_DAYS = 14;      // запись на две недели вперёд

// Настройки расписания из таблицы settings: число постов и часы работы.
function schedule_settings()
{
    $rows = query('SELECT `key`, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    return [
        'posts' => (int) ($rows['posts'] ?? 4),
        'open_hour' => (int) ($rows['open_hour'] ?? 9),
        'close_hour' => (int) ($rows['close_hour'] ?? 21),
    ];
}

function active_services()
{
    $services = query('SELECT id, code, name, description, base_price, hours FROM services
        WHERE is_active = 1 ORDER BY sort, id')->fetchAll();
    foreach ($services as &$service) {
        $service['hours'] = (float) $service['hours'];
    }
    return $services;
}

function all_brands()
{
    $brands = query('SELECT id, name, is_premium FROM brands ORDER BY sort, name')->fetchAll();
    foreach ($brands as &$brand) {
        $brand['is_premium'] = (bool) $brand['is_premium'];
    }
    return $brands;
}

// Всё, что нужно калькулятору и форме записи на лендинге: GET /api/catalog.
function public_catalog()
{
    $bodies = [];
    foreach (BODIES as $id => $body) {
        $bodies[] = ['id' => $id, 'name' => $body['name'], 'k' => $body['k']];
    }
    $schedule = schedule_settings();
    // «Сегодня» по часам сервиса (Москва): от этой даты лендинг рисует 14 дней записи.
    $schedule['today'] = date('Y-m-d');
    $schedule['days'] = BOOKING_DAYS;
    return [
        'services' => active_services(),
        'brands' => all_brands(),
        'bodies' => $bodies,
        'rules' => [
            'premium_k' => PREMIUM_K,
            'discount_from' => DISCOUNT_FROM,
            'discount_rate' => DISCOUNT_RATE,
            'hours_k' => HOURS_K,
        ],
        'schedule' => $schedule,
    ];
}

// Округление до 50 ₽: 2070 → 2050, 2080 → 2100.
function round_50($amount)
{
    return (int) (round($amount / 50) * 50);
}

// Сколько целых часов занимает работа в расписании: 2,3 ч → 3 ч.
// Сначала округляем до сотых, чтобы погрешность дробей (3,0000000001) не добавила лишний час.
function slot_hours($hours)
{
    return (int) ceil(round($hours * 100) / 100);
}

// Расчёт заказа. $services — строки из таблицы services. Возвращает цену каждой услуги,
// сумму, скидку, итог и длительность. Порядок действий тот же, что в calc() на лендинге,
// поэтому результат совпадает до рубля.
function price_order($brandName, $body, $services)
{
    $k = BODIES[$body]['k'];
    $isPremium = (bool) query('SELECT is_premium FROM brands WHERE name = ?', [$brandName])->fetchColumn();
    $pk = $isPremium ? PREMIUM_K : 1;

    $items = [];
    $sum = 0;
    $hours = 0;
    foreach ($services as $service) {
        $price = (int) (round($service['base_price'] * $k * $pk / 50) * 50);
        $items[] = [
            'service_id' => (int) $service['id'],
            'code' => $service['code'],
            'name' => $service['name'],
            'price' => $price,
            'hours' => (float) $service['hours'],
        ];
        $sum += $price;
        $hours += (float) $service['hours'];
    }
    $rate = count($items) >= DISCOUNT_FROM ? DISCOUNT_RATE : 0;
    $total = round_50($sum * (1 - $rate));
    if ($k > 1) {
        $hours *= HOURS_K;
    }

    return [
        'items' => $items,
        'premium' => $isPremium,
        'subtotal' => $sum,
        'discount' => $sum - $total,
        'total' => $total,
        'hours' => round($hours, 2),
        'slot_hours' => slot_hours($hours),
    ];
}
