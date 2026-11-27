<?php
// Проверка полей формы. Каждая функция берёт поле из $data и либо возвращает
// правильное значение, либо сразу отвечает ошибкой 422 с текстом для этого поля.

function invalid($field, $message)
{
    send_error(422, $message, [$field => $message]);
}

// Сколько символов в строке. strlen считает байты, а русская буква занимает 2 байта,
// поэтому считаем символы через mb_strlen (UTF-8).
function text_length($text)
{
    return mb_strlen($text, 'UTF-8');
}

// Обязательный текст, например имя или название.
function text_value($data, $field, $maxLength, $minLength = 1)
{
    $value = $data[$field] ?? '';
    if (!is_string($value)) {
        invalid($field, 'Введите текст.');
    }
    $value = trim($value);
    if ($value === '') {
        invalid($field, 'Обязательное поле.');
    }
    if (text_length($value) < $minLength) {
        invalid($field, "Минимум $minLength символа.");
    }
    if (text_length($value) > $maxLength) {
        invalid($field, 'Слишком длинный текст.');
    }
    return $value;
}

// Необязательный текст, например комментарий. Пустое поле превращается в null (в базе NULL).
function optional_text_value($data, $field, $maxLength)
{
    $value = $data[$field] ?? null;
    if ($value === null) {
        return null;
    }
    if (!is_string($value)) {
        invalid($field, 'Введите текст.');
    }
    $value = trim($value);
    if (text_length($value) > $maxLength) {
        invalid($field, 'Слишком длинный текст.');
    }
    if ($value === '') {
        return null;
    }
    return $value;
}

// Целое число в границах от $min до $max: 4, 2019, 3500.
function int_value($data, $field, $min, $max)
{
    $value = $data[$field] ?? null;
    if (!is_int($value) && !is_string($value)) {
        invalid($field, 'Введите целое число.');
    }
    if (!preg_match('/^\d+$/', (string) $value)) {
        invalid($field, 'Введите целое неотрицательное число.');
    }
    $number = (int) $value;
    if ($number < $min || $number > $max) {
        invalid($field, "Число должно быть от $min до $max.");
    }
    return $number;
}

// Необязательное целое число (например, год выпуска): пустое поле → null.
function optional_int_value($data, $field, $min, $max)
{
    $value = $data[$field] ?? null;
    if ($value === null || $value === '') {
        return null;
    }
    return int_value($data, $field, $min, $max);
}

// Число с дробной частью до двух знаков: 1, 1.5, 0.25 (часы работы услуги).
function decimal_value($data, $field, $min, $max)
{
    $value = $data[$field] ?? null;
    if (!is_int($value) && !is_float($value) && !is_string($value)) {
        invalid($field, 'Введите число.');
    }
    $text = str_replace(',', '.', (string) $value);
    if (!preg_match('/^\d+(\.\d{1,2})?$/', $text)) {
        invalid($field, 'Введите число, до двух знаков после точки.');
    }
    $number = (float) $text;
    if ($number < $min || $number > $max) {
        invalid($field, "Число должно быть от $min до $max.");
    }
    return $number;
}

// Да/нет из флажка формы: true, false, 1, 0.
function bool_value($data, $field)
{
    $value = $data[$field] ?? false;
    return $value === true || $value === 1 || $value === '1';
}

// Значение из короткого списка разрешённых, например кузов sedan/cross/suv.
function choice_value($data, $field, $allowed, $message)
{
    $value = $data[$field] ?? null;
    if (!is_string($value) || !in_array($value, $allowed, true)) {
        invalid($field, $message);
    }
    return $value;
}

// Дата в виде 2026-11-27.
function date_value($data, $field)
{
    $value = $data[$field] ?? null;
    if (!is_string($value)) {
        invalid($field, 'Выберите дату.');
    }
    // Если дату нельзя разобрать или она не существует (2026-02-30), PHP вернёт
    // другую строку, и сравнение не совпадёт.
    $date = DateTime::createFromFormat('Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value || $value < '2000-01-01' || $value > '2100-12-31') {
        invalid($field, 'Введите корректную дату.');
    }
    return $value;
}

function email_value($data)
{
    $email = strtolower(text_value($data, 'email', 255));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        invalid('email', 'Введите корректный email.');
    }
    return $email;
}

// Пароль от 8 до 72 байт. Больше 72 нельзя: password_hash учитывает только первые 72 байта.
function password_value($data, $field = 'password')
{
    $password = $data[$field] ?? null;
    if (!is_string($password) || $password === '') {
        invalid($field, 'Введите пароль.');
    }
    if (strlen($password) < 8 || strlen($password) > 72) {
        invalid($field, 'Пароль должен содержать от 8 до 72 символов.');
    }
    return $password;
}

// Российский номер телефона. Принимаем любую запись (8 999 123-45-67, +79991234567)
// и приводим к одному виду: +7 (999) 123-45-67.
function phone_value($data, $field = 'phone')
{
    $value = $data[$field] ?? '';
    if (!is_string($value)) {
        invalid($field, 'Введите телефон.');
    }
    $digits = preg_replace('/\D/', '', $value);
    if (strlen($digits) === 11 && $digits[0] === '8') {
        $digits = '7' . substr($digits, 1);
    }
    if (strlen($digits) !== 11 || $digits[0] !== '7') {
        invalid($field, 'Проверьте номер телефона: нужно 11 цифр, начиная с +7.');
    }
    return sprintf('+7 (%s) %s-%s-%s', substr($digits, 1, 3), substr($digits, 4, 3),
        substr($digits, 7, 2), substr($digits, 9, 2));
}

// Список из формы, например коды услуг.
function list_value($data, $field, $message)
{
    $list = $data[$field] ?? [];
    if (!is_array($list) || !array_is_list($list)) {
        invalid($field, $message);
    }
    return $list;
}
