<?php
// Демо-данные: аккаунты клиента и администратора, гараж и записи за прошлую неделю
// и на ближайшие дни, чтобы в кабинете и админке было что показать.
// Все записи и аккаунты помечены is_demo = 1, интерфейс показывает у них метку «демо».
// Запускать после миграций, только из консоли:
//   php database/seed-demo.php               — пересоздать демо-данные со свежими датами
//   php database/seed-demo.php --if-missing  — создать, только если демо-клиента ещё нет
// Оба варианта можно запускать сколько угодно раз.
require dirname(__DIR__) . '/backend/config.php';
require dirname(__DIR__) . '/backend/http.php';
require dirname(__DIR__) . '/backend/database.php';
require dirname(__DIR__) . '/backend/catalog.php';
require dirname(__DIR__) . '/backend/slots.php';
require dirname(__DIR__) . '/backend/bookings.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}
// Тот же часовой пояс, что в backend/bootstrap.php, чтобы «сегодня» совпадало с приложением.
date_default_timezone_set('Europe/Moscow');

$onlyIfMissing = in_array('--if-missing', $argv, true);

// Демо-логины. Они же показаны на странице входа, когда DEMO_MODE=1.
const DEMO_CLIENT_EMAIL = 'client@oborot.demo';
const DEMO_CLIENT_PASSWORD = 'OborotClient2026';
const DEMO_ADMIN_EMAIL = 'admin@oborot.demo';
const DEMO_ADMIN_PASSWORD = 'OborotAdmin2026';

// Администратор с известным всем паролем создаётся только там, где это не опасно:
// на своём компьютере (APP_ENV=development) или на публичном демо, где в админке
// можно менять только статусы записей (DEMO_MODE=1, см. public/index.php).
$adminAllowed = config('APP_ENV') === 'development' || config('DEMO_MODE') === '1';
$adminId = (int) query('SELECT id FROM users WHERE email = ?', [DEMO_ADMIN_EMAIL])->fetchColumn();
if ($adminAllowed && !$adminId) {
    $adminId = insert("INSERT INTO users (email, password_hash, name, phone, role, is_demo) VALUES (?, ?, ?, ?, 'admin', 1)",
        [DEMO_ADMIN_EMAIL, password_hash(DEMO_ADMIN_PASSWORD, PASSWORD_DEFAULT), 'Администратор (демо)', '+7 (900) 000-00-00']);
    echo 'Admin account: ' . DEMO_ADMIN_EMAIL . ' / ' . DEMO_ADMIN_PASSWORD . "\n";
}

$existingClient = query('SELECT id FROM users WHERE email = ?', [DEMO_CLIENT_EMAIL])->fetchColumn();
if ($existingClient && $onlyIfMissing) {
    echo 'Demo data already exists: ' . DEMO_CLIENT_EMAIL . "\n";
    exit(0);
}

$db = database();
$db->beginTransaction();

// --- Убираем старые демо-данные ---
// Демо-записи и записи демо-клиентов (их могли сделать посетители, войдя в демо-аккаунт).
$demoClientIds = query("SELECT id FROM users WHERE is_demo = 1 AND role = 'client'")->fetchAll(PDO::FETCH_COLUMN);
query('DELETE FROM bookings WHERE is_demo = 1');
foreach ($demoClientIds as $id) {
    query('DELETE FROM bookings WHERE user_id = ?', [$id]);
    query('DELETE FROM users WHERE id = ?', [$id]); // машины удалятся вместе с владельцем
}

// --- Клиенты ---
// Войти можно только в первый аккаунт. У остальных пароль — случайная строка,
// они нужны, чтобы в админке был список клиентов.
function demo_user($email, $name, $phone, $password = null)
{
    $password ??= bin2hex(random_bytes(16));
    return insert("INSERT INTO users (email, password_hash, name, phone, role, is_demo) VALUES (?, ?, ?, ?, 'client', 1)",
        [$email, password_hash($password, PASSWORD_DEFAULT), $name, $phone]);
}
$clients = [
    'alexey' => demo_user(DEMO_CLIENT_EMAIL, 'Алексей Смирнов', '+7 (900) 000-00-01', DEMO_CLIENT_PASSWORD),
    'maria' => demo_user('maria@oborot.demo', 'Мария Иванова', '+7 (900) 000-00-02'),
    'igor' => demo_user('igor@oborot.demo', 'Игорь Ким', '+7 (900) 000-00-03'),
    'olga' => demo_user('olga@oborot.demo', 'Ольга Петрова', '+7 (900) 000-00-04'),
];
$clientInfo = query("SELECT id, name, phone FROM users WHERE is_demo = 1 AND role = 'client'")->fetchAll(PDO::FETCH_UNIQUE);

// Гараж демо-клиента. Госномера вымышленные.
$cars = [
    'camry' => insert("INSERT INTO cars (user_id, brand, model, body, year, plate) VALUES (?, 'Toyota', 'Camry', 'sedan', 2019, 'А001АА 77')",
        [$clients['alexey']]),
    'jolion' => insert("INSERT INTO cars (user_id, brand, model, body, year, plate) VALUES (?, 'Haval', 'Jolion', 'cross', 2022, NULL)",
        [$clients['alexey']]),
];
$carInfo = query('SELECT id, brand, body FROM cars WHERE user_id = ?', [$clients['alexey']])->fetchAll(PDO::FETCH_UNIQUE);

// --- Записи ---
// [через сколько дней (минус — в прошлом), час начала, кто, марка, кузов, услуги, статус, комментарий].
// «Кто» — ключ клиента из $clients, машина ['car', ключ] или гость ['Имя', 'телефон'].
// Для сегодняшних записей статус уточняется по времени: прошедшие — выполнены, идущие — в работе.
$plan = [
    [-10, 12, 'alexey', 'Toyota', 'sedan', ['wash'], 'done', null],
    [-6, 10, ['Дмитрий', '+7 (900) 000-00-11'], 'Kia', 'cross', ['wash', 'inter'], 'done', null],
    [-6, 14, 'maria', 'BMW', 'sedan', ['polish'], 'done', null],
    [-5, 9, 'igor', 'Toyota', 'sedan', ['to', 'diag'], 'done', null],
    [-5, 12, ['Сергей', '+7 (900) 000-00-12'], 'Lada', 'sedan', ['tires'], 'no_show', null],
    [-4, 11, ['car', 'camry'], null, null, ['to', 'diag', 'tires'], 'done', 'Заодно посмотрите тормозные колодки'],
    [-3, 10, 'olga', 'Haval', 'cross', ['wash'], 'done', null],
    [-3, 15, ['Павел', '+7 (900) 000-00-13'], 'Audi', 'suv', ['film', 'wash'], 'cancelled', null],
    [-2, 9, 'maria', 'Mercedes', 'sedan', ['ceram'], 'done', null],
    [-1, 13, ['Анна', '+7 (900) 000-00-14'], 'Hyundai', 'sedan', ['diag'], 'done', 'Горит check engine'],
    [-1, 16, 'igor', 'Toyota', 'sedan', ['wash', 'tires'], 'done', null],
    [0, 9, 'olga', 'Haval', 'cross', ['to'], 'confirmed', null],
    [0, 10, ['Никита', '+7 (900) 000-00-15'], 'Skoda', 'cross', ['polish'], 'confirmed', null],
    [0, 14, ['Елена', '+7 (900) 000-00-16'], 'Kia', 'sedan', ['wash', 'diag'], 'new', null],
    [0, 16, 'igor', 'Lexus', 'suv', ['film'], 'confirmed', null],
    [0, 18, ['Роман', '+7 (900) 000-00-17'], 'Chery', 'cross', ['tires'], 'new', null],
    [1, 9, ['Виктор', '+7 (900) 000-00-18'], 'Volkswagen', 'sedan', ['to'], 'confirmed', null],
    [1, 11, ['car', 'camry'], null, null, ['wash', 'inter'], 'confirmed', 'Пятно от кофе на заднем сиденье'],
    [1, 13, 'maria', 'BMW', 'sedan', ['diag'], 'new', null],
    [1, 12, ['Артём', '+7 (900) 000-00-19'], 'Haval', 'cross', ['polish'], 'new', null],
    [2, 10, ['Кирилл', '+7 (900) 000-00-20'], 'Toyota', 'suv', ['ceram'], 'confirmed', null],
    [2, 10, ['Тимур', '+7 (900) 000-00-21'], 'Kia', 'sedan', ['wash'], 'confirmed', null],
    [2, 10, ['Григорий', '+7 (900) 000-00-22'], 'Lada', 'sedan', ['to'], 'new', null],
    [2, 10, ['Вера', '+7 (900) 000-00-23'], 'Hyundai', 'sedan', ['diag'], 'new', 'Стучит справа на кочках'],
    [2, 12, 'olga', 'Haval', 'cross', ['wash'], 'new', null],
    [3, 15, ['car', 'jolion'], null, null, ['tires', 'wash'], 'new', null],
    [4, 9, ['Ирина', '+7 (900) 000-00-24'], 'Kia', 'cross', ['to', 'diag', 'film'], 'new', null],
    [5, 17, 'igor', 'Toyota', 'sedan', ['diag'], 'new', null],
];

// Цепочка статусов от новой записи до итоговой — для истории в карточке записи.
$paths = [
    'new' => ['new'],
    'confirmed' => ['new', 'confirmed'],
    'in_work' => ['new', 'confirmed', 'in_work'],
    'done' => ['new', 'confirmed', 'in_work', 'done'],
    'cancelled' => ['new', 'cancelled'],
    'no_show' => ['new', 'confirmed', 'no_show'],
];

$settings = schedule_settings();
$now = new DateTimeImmutable();
$created = 0;
foreach ($plan as [$dayOffset, $hour, $who, $brand, $body, $codes, $status, $comment]) {
    $date = date('Y-m-d', strtotime("$dayOffset days"));
    $userId = null;
    $carId = null;
    if (is_string($who)) {
        $userId = $clients[$who];
        [$name, $phone] = [$clientInfo[$userId]['name'], $clientInfo[$userId]['phone']];
    } elseif ($who[0] === 'car') {
        $userId = $clients['alexey'];
        $carId = $cars[$who[1]];
        [$name, $phone] = [$clientInfo[$userId]['name'], $clientInfo[$userId]['phone']];
        [$brand, $body] = [$carInfo[$carId]['brand'], $carInfo[$carId]['body']];
    } else {
        [$name, $phone] = $who;
    }

    $placeholders = implode(',', array_fill(0, count($codes), '?'));
    $services = query("SELECT id, code, name, base_price, hours FROM services WHERE code IN ($placeholders) ORDER BY sort, id",
        $codes)->fetchAll();
    $order = price_order($brand, $body, $services);

    // Свободный пост: если на это время всё занято (например, посетитель уже записался),
    // сдвигаем запись на час позже, а если до закрытия не помещается — пропускаем.
    $load = hour_load($date);
    while ($hour + $order['slot_hours'] <= $settings['close_hour'] && free_posts($load, $hour, $order['slot_hours'], $settings) === 0) {
        $hour++;
    }
    if ($hour + $order['slot_hours'] > $settings['close_hour']) {
        continue;
    }
    $start = new DateTimeImmutable(sprintf('%s %02d:00', $date, $hour));
    $end = $start->modify('+' . $order['slot_hours'] . ' hours');

    // Сегодняшние записи: что уже закончилось — выполнено, что идёт сейчас — в работе.
    if ($dayOffset === 0 && $end <= $now) {
        $status = 'done';
    } elseif ($dayOffset === 0 && $start <= $now) {
        $status = 'in_work';
    }

    // Запись «создана» за день-два до начала, но не позже текущего момента.
    $createdAt = $start->modify('-' . (1 + $hour % 2) . ' days -3 hours');
    if ($createdAt > $now) {
        $createdAt = $now->modify('-1 hour');
    }

    $bookingId = insert('INSERT INTO bookings (user_id, car_id, brand, body, starts_at, ends_at, customer_name, phone,
        comment, subtotal, discount, total, hours, status, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', [
        $userId, $carId, $brand, $body, $start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s'), $name, $phone,
        $comment, $order['subtotal'], $order['discount'], $order['total'], $order['hours'], $status,
        $createdAt->format('Y-m-d H:i:s'),
    ]);
    foreach ($order['items'] as $item) {
        query('INSERT INTO booking_items (booking_id, service_id, name, price, hours) VALUES (?, ?, ?, ?, ?)',
            [$bookingId, $item['service_id'], $item['name'], $item['price'], $item['hours']]);
    }

    // История: создал клиент (или гость), дальше статусы менял администратор.
    $eventTimes = [
        'new' => $createdAt,
        'confirmed' => $createdAt->modify('+40 minutes'),
        'cancelled' => $createdAt->modify('+2 hours'),
        'in_work' => $start,
        'done' => $end,
        'no_show' => $start->modify('+1 hour'),
    ];
    foreach ($paths[$status] as $step) {
        $time = min($eventTimes[$step], $now);
        query('INSERT INTO booking_events (booking_id, status, user_id, created_at) VALUES (?, ?, ?, ?)',
            [$bookingId, $step, $step === 'new' ? $userId : ($adminId ?: null), $time->format('Y-m-d H:i:s')]);
    }
    $created++;
}

$db->commit();
echo "Demo bookings: $created\n";
echo 'Demo client: ' . DEMO_CLIENT_EMAIL . ' / ' . DEMO_CLIENT_PASSWORD . "\n";
