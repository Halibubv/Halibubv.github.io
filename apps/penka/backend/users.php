<?php
// Демо-аккаунты и управление ролями в админке.

// Демо-аккаунты. Их создаёт database/seed-demo.php, а страница входа показывает
// их, когда включён DEMO_MODE=1 (сервер отдаёт их в GET /api/session).
const DEMO_ACCOUNTS = [
    ['role' => 'client', 'email' => 'demo@penka.local', 'password' => 'PenkaDemo2026', 'name' => 'Анна (демо-гость)', 'phone' => '+7 (900) 000-00-01'],
    ['role' => 'admin', 'email' => 'admin@penka.local', 'password' => 'PenkaAdmin2026', 'name' => 'Бариста (демо)', 'phone' => '+7 (900) 000-00-02'],
];

// Логины для страницы входа — только на публичном демо.
function demo_logins()
{
    if (!demo_mode()) {
        return [];
    }
    return array_map(fn($account) => [
        'role' => $account['role'],
        'email' => $account['email'],
        'password' => $account['password'],
    ], DEMO_ACCOUNTS);
}

function is_demo_account($user)
{
    return in_array($user['email'], array_column(DEMO_ACCOUNTS, 'email'), true);
}

function admin_users()
{
    return query('SELECT u.id, u.email, u.name, u.phone, u.role, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
        (SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id) AS reservations_count
        FROM users u ORDER BY u.role, u.created_at DESC LIMIT 200')->fetchAll();
}

function set_user_role($admin, $id, $data)
{
    $role = choice_value($data, 'role', ['client', 'admin'], 'Выберите роль.');
    if ($id === (int) $admin['id']) {
        send_error(409, 'Свою роль поменять нельзя: так можно случайно остаться без администратора.');
    }
    if (!query('SELECT id FROM users WHERE id = ?', [$id])->fetch()) {
        send_error(404, 'Пользователь не найден.');
    }
    query('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
}
