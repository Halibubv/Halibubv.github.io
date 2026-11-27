<?php
// Профиль клиента: имя, телефон и смена пароля.

function update_profile($userId, $data)
{
    $name = text_value($data, 'name', 100, 2);
    $phone = phone_value($data);
    query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [$name, $phone, $userId]);
}

// Новый пароль только вместе с текущим: если кто-то сел за чужой открытый браузер,
// он не сможет сменить пароль и забрать аккаунт.
function change_password($userId, $data)
{
    $current = $data['current_password'] ?? null;
    if (!is_string($current) || $current === '') {
        invalid('current_password', 'Введите текущий пароль.');
    }
    $password = password_value($data, 'password');

    $hash = query('SELECT password_hash FROM users WHERE id = ?', [$userId])->fetchColumn();
    if (!password_verify($current, $hash)) {
        invalid('current_password', 'Текущий пароль неверный.');
    }
    // На публичном демо пароль демо-клиента написан на странице входа:
    // если его сменить, следующий посетитель не войдёт.
    $isDemo = query('SELECT is_demo FROM users WHERE id = ?', [$userId])->fetchColumn();
    if (demo_mode() && $isDemo) {
        send_error(403, 'Это демо-аккаунт: пароль менять нельзя, иначе другие посетители не смогут войти.');
    }
    query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $userId]);
    // Новый номер сессии: старый, если его кто-то узнал, больше не действует.
    session_regenerate_id(true);
}
