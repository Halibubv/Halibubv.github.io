<?php
// Заказы с собой: оформление с сайта, кабинет клиента и доска заказов в админке.
// Цены всегда берём из базы: сумму, присланную браузером, не принимаем вообще.

const ORDER_MAX_LINES = 30;
const ORDER_MAX_QTY = 20;
// Куда можно перевести заказ из каждого статуса.
const ORDER_NEXT = [
    'new' => ['accepted', 'cancelled'],
    'accepted' => ['ready', 'cancelled'],
    'ready' => ['issued', 'cancelled'],
    'issued' => [],
    'cancelled' => [],
];

function create_order($data, $user)
{
    $name = text_value($data, 'name', 100, 2);
    $phone = phone_value($data);
    $comment = optional_text_value($data, 'comment', 300);
    $readyAt = datetime_value($data, 'ready_at');
    if (!in_array($readyAt, pickup_times(), true)) {
        invalid('ready_at', 'Ко времени нельзя: выберите время в часы работы, не раньше чем через 15 минут.');
    }

    // Позиции: [{id: 5, qty: 2}, ...]. Одинаковые позиции складываем.
    $lines = $data['items'] ?? null;
    if (!is_array($lines) || !$lines) {
        invalid('items', 'Корзина пуста.');
    }
    if (count($lines) > ORDER_MAX_LINES) {
        invalid('items', 'Слишком много позиций в одном заказе.');
    }
    $quantities = [];
    foreach ($lines as $line) {
        if (!is_array($line)) {
            invalid('items', 'Неверный состав заказа.');
        }
        $id = int_value($line, 'id', 1, PHP_INT_MAX);
        $qty = int_value($line, 'qty', 1, ORDER_MAX_QTY);
        $quantities[$id] = min(ORDER_MAX_QTY, ($quantities[$id] ?? 0) + $qty);
    }

    $userId = $user ? $user['id'] : null;
    $order = transaction(function () use ($quantities, $userId, $name, $phone, $comment, $readyAt) {
        // Позиции читаем с блокировкой (FOR SHARE): пока заказ сохраняется, администратор
        // не поставит их в стоп-лист «посередине».
        $marks = implode(',', array_fill(0, count($quantities), '?'));
        $rows = query("SELECT id, name, price, is_available, is_hidden FROM menu_items WHERE id IN ($marks) FOR SHARE",
            array_keys($quantities))->fetchAll();
        $items = [];
        foreach ($rows as $row) {
            $items[$row['id']] = $row;
        }
        $total = 0;
        foreach ($quantities as $id => $qty) {
            $item = $items[$id] ?? null;
            if (!$item || $item['is_hidden']) {
                send_error(422, 'Одной из позиций больше нет в меню. Обновите страницу.', ['items' => 'Позиции нет в меню.']);
            }
            if (!$item['is_available']) {
                send_error(422, "«{$item['name']}» сейчас нет в наличии. Уберите эту позицию из корзины.",
                    ['items' => "«{$item['name']}» нет в наличии."]);
            }
            $total += $item['price'] * $qty;
        }

        $orderId = insert('INSERT INTO orders (user_id, customer_name, phone, comment, ready_at, total) VALUES (?, ?, ?, ?, ?, ?)',
            [$userId, $name, $phone, $comment, $readyAt . ':00', $total]);
        // В заказ пишем снимок названия и цены: если цену потом поменяют, старый заказ не изменится.
        foreach ($quantities as $id => $qty) {
            query('INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)',
                [$orderId, $id, $items[$id]['name'], $items[$id]['price'], $qty]);
        }
        log_status('order', $orderId, 'new', $userId);
        return find_order($orderId);
    });

    $lines = array_map(fn($item) => "• {$item['name']} × {$item['qty']}", $order['items']);
    notify_telegram("Новый заказ с собой №{$order['id']} к " . format_day($order['ready_at']) . ', ' . substr($order['ready_at'], 11, 5)
        . "\n" . implode("\n", $lines) . "\nСумма: {$order['total']} ₽\n{$name}, {$phone}" . ($comment ? "\n«{$comment}»" : ''));
    return $order;
}

function find_order($id)
{
    $order = query('SELECT * FROM orders WHERE id = ?', [$id])->fetch();
    if (!$order) {
        send_error(404, 'Заказ не найден.');
    }
    return with_order_items([$order])[0];
}

// Добавить к заказам их позиции одним запросом (а не по запросу на каждый заказ).
function with_order_items($orders)
{
    if (!$orders) {
        return [];
    }
    $ids = array_column($orders, 'id');
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $rows = query("SELECT order_id, menu_item_id, name, price, qty FROM order_items WHERE order_id IN ($marks) ORDER BY id", $ids)->fetchAll();
    $byOrder = [];
    foreach ($rows as $row) {
        $byOrder[$row['order_id']][] = $row;
    }
    foreach ($orders as &$order) {
        $order['ready_at'] = substr($order['ready_at'], 0, 16);
        $order['items'] = $byOrder[$order['id']] ?? [];
    }
    return $orders;
}

// Заказы клиента — только свои.
function user_orders($userId)
{
    $orders = query('SELECT id, comment, ready_at, total, status, created_at FROM orders WHERE user_id = ?
        ORDER BY created_at DESC, id DESC LIMIT 50', [$userId])->fetchAll();
    return with_order_items($orders);
}

// --- Админка ---

// Доска: всё незавершённое плюс выданные и отменённые за сегодня.
function admin_orders()
{
    $orders = query("SELECT * FROM orders WHERE status IN ('new', 'accepted', 'ready')
        OR ready_at >= CURDATE() OR created_at >= CURDATE()
        ORDER BY ready_at, id")->fetchAll();
    return with_order_items($orders);
}

function set_order_status($id, $data, $admin)
{
    $status = choice_value($data, 'status', array_keys(ORDER_NEXT), 'Неизвестный статус.');
    transaction(function () use ($id, $status, $admin) {
        $current = query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [$id])->fetchColumn();
        if ($current === false) {
            send_error(404, 'Заказ не найден.');
        }
        if (!in_array($status, ORDER_NEXT[$current], true)) {
            send_error(409, 'Заказ уже в другом статусе. Обновите страницу.');
        }
        query('UPDATE orders SET status = ? WHERE id = ?', [$status, $id]);
        log_status('order', $id, $status, $admin['id']);
    });
    return find_order($id);
}

// Экран «Сегодня»: брони на сегодня, активные заказы и цифры — всё из базы.
function admin_today()
{
    $today = date('Y-m-d');
    $guests = query('SELECT COALESCE(SUM(guests), 0) FROM reservations
        WHERE starts_at >= CURDATE() AND starts_at < CURDATE() + INTERVAL 1 DAY AND status IN (' . busy_statuses_sql() . ')')->fetchColumn();
    // Выручка — по выданным заказам; день заказа — день, к которому его готовили.
    $revenueToday = query("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'issued'
        AND ready_at >= CURDATE() AND ready_at < CURDATE() + INTERVAL 1 DAY")->fetchColumn();
    $revenueWeek = query("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'issued'
        AND ready_at >= CURDATE() - INTERVAL 6 DAY AND ready_at < CURDATE() + INTERVAL 1 DAY")->fetchColumn();
    $issuedToday = query("SELECT COUNT(*) FROM orders WHERE status = 'issued'
        AND ready_at >= CURDATE() AND ready_at < CURDATE() + INTERVAL 1 DAY")->fetchColumn();
    $active = with_order_items(query("SELECT * FROM orders WHERE status IN ('new', 'accepted', 'ready') ORDER BY ready_at, id")->fetchAll());

    return [
        'date' => $today,
        'reservations' => admin_reservations($today),
        'active_orders' => $active,
        'guests_expected' => (int) $guests,
        'revenue_today' => (int) $revenueToday,
        'revenue_week' => (int) $revenueWeek,
        'issued_today' => (int) $issuedToday,
    ];
}
