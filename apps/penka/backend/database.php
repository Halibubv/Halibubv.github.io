<?php
// Подключение к базе MySQL через PDO и короткие функции для запросов.

// Параметры подключения: хост, порт, пользователь, пароль и имя базы.
// На хостинге база задаётся одной строкой DATABASE_URL, например:
// mysql://avnadmin:пароль@mysql-xxxx.aivencloud.com:12345/defaultdb
// На своём компьютере — отдельными настройками DB_HOST, DB_USER и т. д. в .env.
// DB_NAME, если задан, главнее имени из DATABASE_URL: на Render в адресе стоит
// общая база defaultdb, а у Пенки на том же сервере своя база penka.
function database_settings()
{
    $url = config('DATABASE_URL');
    if ($url !== '') {
        $parts = parse_url($url);
        $settings = [
            'host' => $parts['host'] ?? '127.0.0.1',
            'port' => $parts['port'] ?? 3306,
            'name' => urldecode(ltrim($parts['path'] ?? '', '/')),
            'user' => urldecode($parts['user'] ?? ''),
            'password' => urldecode($parts['pass'] ?? ''),
        ];
    } else {
        $settings = [
            'host' => config('DB_HOST', '127.0.0.1'),
            'port' => config('DB_PORT', '3306'),
            'name' => 'penka',
            'user' => config('DB_USER', 'penka'),
            'password' => config('DB_PASSWORD'),
        ];
    }
    if (config('DB_NAME') !== '') {
        $settings['name'] = config('DB_NAME');
    }
    // Имя базы попадает в SQL migrate.php (CREATE DATABASE), поэтому пускаем только
    // латинские буквы, цифры и подчёркивание.
    if (!preg_match('/^[A-Za-z0-9_]+$/', $settings['name'])) {
        throw new RuntimeException('DB_NAME may contain only letters, digits and _.');
    }
    return $settings;
}

// Новое подключение к серверу MySQL. $withDatabase = false — без выбора базы:
// так migrate.php может сначала создать базу, если её ещё нет.
function connect_database($withDatabase = true)
{
    $settings = database_settings();
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,       // ошибка SQL сразу останавливает запрос
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,  // строки приходят массивами ['name' => ...]
        PDO::ATTR_EMULATE_PREPARES => false,               // числа из базы приходят числами
    ];

    // Облачная база (Aiven) пускает только по защищённому соединению SSL.
    $certificate = ssl_certificate_file();
    if ($certificate !== '') {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $certificate;
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }

    // charset=utf8mb4 — чтобы русские буквы не превращались в знаки вопроса.
    $dsn = "mysql:host={$settings['host']};port={$settings['port']};charset=utf8mb4";
    if ($withDatabase) {
        $dsn .= ";dbname={$settings['name']}";
    }
    $pdo = new PDO($dsn, $settings['user'], $settings['password'], $options);
    // Время в базе — московское, как в PHP (bootstrap.php). Тогда NOW() в SQL
    // и date() в PHP показывают одно и то же. В Москве нет перехода на летнее время.
    $pdo->exec("SET time_zone = '+03:00'");
    return $pdo;
}

// Подключение для запросов приложения. Подключаемся один раз за запрос:
// static-переменная запоминает подключение между вызовами функции.
function database()
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = connect_database();
    }
    return $pdo;
}

// Сертификат облачной базы (файл ca.pem из панели Aiven) задаётся в настройке DB_SSL_CA.
// Там может быть путь к файлу или сам текст сертификата. PDO понимает только путь,
// поэтому текст сохраняем во временный файл.
function ssl_certificate_file()
{
    $value = trim(config('DB_SSL_CA'));
    if ($value === '' || is_file($value)) {
        return $value;
    }

    // При копировании в настройки хостинга теряются переносы строк. Убираем строки
    // BEGIN/END и всё лишнее, оставляем сам код и собираем файл заново по 64 символа в строке.
    $code = preg_replace('/-----[A-Z ]+-----/', '', $value);
    $code = preg_replace('/[^A-Za-z0-9+\/=]/', '', $code);
    $text = "-----BEGIN CERTIFICATE-----\n" . chunk_split($code, 64, "\n") . "-----END CERTIFICATE-----\n";

    $file = sys_get_temp_dir() . '/penka-db-ca.pem';
    file_put_contents($file, $text);
    return $file;
}

// Выполнить SQL-запрос. Вместо значений в SQL пишем знаки ?, а сами значения
// передаём массивом: так PDO защищает от SQL-инъекций.
// Пример: query('SELECT * FROM users WHERE id = ?', [5])->fetch();
function query($sql, $values = [])
{
    $statement = database()->prepare($sql);
    $statement->execute($values);
    return $statement;
}

// INSERT, который возвращает id только что добавленной строки.
function insert($sql, $values = [])
{
    query($sql, $values);
    return (int) database()->lastInsertId();
}

// Выполнить функцию в транзакции: сохранится либо всё, либо ничего.
// Если внутри ошибка — откатываем. Если внутри send_error() (он завершает скрипт),
// незавершённую транзакцию MySQL откатит сам, когда закроется подключение.
function transaction($action)
{
    $db = database();
    $db->beginTransaction();
    try {
        $result = $action();
        $db->commit();
        return $result;
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

// Команды SQL-файла по одной (для migrate.php и seed-demo.php).
// Команды в файле разделены точкой с запятой в конце строки.
function sql_statements($file)
{
    $result = [];
    foreach (preg_split('/;\s*$/m', file_get_contents($file)) as $statement) {
        if (trim(preg_replace('/^\s*--.*$/m', '', $statement)) !== '') {
            $result[] = $statement; // пустые куски и одни комментарии пропускаем
        }
    }
    return $result;
}

// Записать смену статуса брони или заказа в журнал status_events.
function log_status($entity, $entityId, $status, $userId)
{
    query('INSERT INTO status_events (entity, entity_id, status, user_id) VALUES (?, ?, ?, ?)',
        [$entity, $entityId, $status, $userId]);
}
