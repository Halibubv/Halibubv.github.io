<?php
// Настройки приложения: адрес базы данных, пароль и т. д.
// Сначала смотрим переменные окружения (так настройки задаются на хостинге Render),
// потом файл apps/penka/.env (так удобно на своём компьютере). Файл .env в Git не попадает.

function config($name, $default = '')
{
    $value = getenv($name);
    if ($value !== false) {
        return $value;
    }

    // Файл читаем один раз за запрос и запоминаем в static-переменной.
    static $settings = null;
    if ($settings === null) {
        $file = __DIR__ . '/../.env';
        $settings = is_file($file) ? parse_ini_file($file, false, INI_SCANNER_RAW) : [];
    }
    if (isset($settings[$name])) {
        return $settings[$name];
    }

    return $default;
}

// Включён ли публичный демо-режим (DEMO_MODE=1).
function demo_mode()
{
    return config('DEMO_MODE') === '1';
}
