<?php
// Создать администратора или сделать администратором существующего пользователя.
// Только из консоли: php database/create-admin.php admin@example.com "пароль-от-8-символов" "Имя"
require dirname(__DIR__) . '/backend/config.php';
require dirname(__DIR__) . '/backend/database.php';

if (PHP_SAPI !== 'cli' || count($argv) < 3) {
    fwrite(STDERR, "Usage: php database/create-admin.php email password [name]\n");
    exit(1);
}
$email = strtolower(trim($argv[1]));
$password = $argv[2];
$name = $argv[3] ?? 'Администратор';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 72) {
    fwrite(STDERR, "Need a valid email and a password of 8-72 bytes.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$id = query('SELECT id FROM users WHERE email = ?', [$email])->fetchColumn();
if ($id) {
    query("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?", [$hash, $id]);
    echo "User {$email} is now an admin.\n";
} else {
    query("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')", [$email, $hash, $name]);
    echo "Admin {$email} created.\n";
}
