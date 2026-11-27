<?php
// Миграции: создаёт базу (если её ещё нет), затем выполняет по порядку файлы
// database/*.sql, которые ещё не выполнялись, и отмечает их в таблице migrations.
// Запуск только из консоли: php database/migrate.php
require dirname(__DIR__) . '/backend/config.php';
require dirname(__DIR__) . '/backend/database.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}

// Сначала подключаемся к серверу без базы и создаём свою базу. На Aiven
// в DATABASE_URL стоит общая defaultdb, а Пенке нужна своя (DB_NAME=penka).
// Имя базы проверено в database_settings(): только буквы, цифры и _.
$name = database_settings()['name'];
connect_database(false)->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

$db = database();

// Блокировка не даёт двум одновременным запускам выполнить одну миграцию дважды.
// GET_LOCK ждёт до 30 секунд, пока другой запуск не закончит.
$locked = query("SELECT GET_LOCK('penka_migrations', 30)")->fetchColumn();
if ((int) $locked !== 1) {
    fwrite(STDERR, "Another migration is running.\n");
    exit(1);
}

$db->exec('CREATE TABLE IF NOT EXISTS migrations (
    name VARCHAR(150) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4');

// glob возвращает файлы по алфавиту, поэтому номера 001, 002... задают порядок.
foreach (glob(__DIR__ . '/*.sql') as $file) {
    $fileName = basename($file);
    if (query('SELECT 1 FROM migrations WHERE name = ?', [$fileName])->fetchColumn()) {
        continue;
    }
    // CREATE TABLE в MySQL нельзя откатить, поэтому транзакции здесь нет:
    // если команда упала, исправьте файл и удалите уже созданные им таблицы вручную.
    foreach (sql_statements($file) as $statement) {
        $db->exec($statement);
    }
    query('INSERT INTO migrations (name) VALUES (?)', [$fileName]);
    echo 'Applied ' . $fileName . "\n";
}

query("SELECT RELEASE_LOCK('penka_migrations')");
