<?php
// Настройки приложения: адрес базы данных, пароль, демо-режим и т. д.
// Сначала смотрим переменные окружения (так настройки задаются на хостинге Render),
// потом файл .env в папке приложения (так удобно на своём компьютере). Файл .env в Git не попадает.

function config($name, $default = '')
{
    $value = getenv($name);
    if ($value !== false) {
        return $value;
    }

    // Файл читаем один раз за запрос и запоминаем в static-переменной.
    static $settings = null;
    if ($settings === null) {
        $settings = [];
        $file = __DIR__ . '/../.env';
        if (is_file($file)) {
            $settings = parse_ini_file($file, false, INI_SCANNER_RAW) ?: [];
        }
    }
    if (isset($settings[$name])) {
        // Значение в кавычках ("пароль") — кавычки не часть значения.
        return preg_replace('/^"(.*)"$/s', '$1', $settings[$name]);
    }

    return $default;
}

// Включён ли публичный демо-режим (DEMO_MODE=1).
function demo_mode()
{
    return config('DEMO_MODE') === '1';
}
