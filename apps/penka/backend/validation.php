<?php
// Проверка полей формы. Каждая функция берёт поле из $data и либо возвращает
// правильное значение, либо сразу отвечает ошибкой 422 с текстом для этого поля.

function invalid($field, $message)
{
    send_error(422, $message, [$field => $message]);
}

// Сколько символов в строке. strlen считает байты, а русская буква занимает 2 байта,
// поэтому считаем символы регулярным выражением (флаг u — работать с UTF-8).
function text_length($text)
{
    return preg_match_all('/./us', $text);
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
        invalid($field, 'Заполните это поле.');
    }
    if (text_length($value) < $minLength) {
        invalid($field, 'Слишком короткий текст.');
    }
    if (text_length($value) > $maxLength) {
        invalid($field, 'Слишком длинный текст.');
    }
    return $value;
}

// Необязательный текст, например пожелания. Пустое поле превращается в null (в базе NULL).
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

// Целое число в границах от $min до $max: число гостей, количество, цена.
function int_value($data, $field, $min, $max)
{
    $value = $data[$field] ?? null;
    if (is_string($value) && preg_match('/^\d+$/', $value)) {
        $value = (int) $value;
    }
    if (!is_int($value)) {
        invalid($field, 'Введите целое число.');
    }
    if ($value < $min || $value > $max) {
        invalid($field, "Введите число от $min до $max.");
    }
    return $value;
}

// Да/нет из флажка: true/false или 1/0.
function bool_value($data, $field)
{
    $value = $data[$field] ?? null;
    if ($value === true || $value === 1 || $value === '1') {
        return true;
    }
    if ($value === false || $value === 0 || $value === '0') {
        return false;
    }
    invalid($field, 'Ожидается да или нет.');
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
    if (!$date || $date->format('Y-m-d') !== $value) {
        invalid($field, 'Введите корректную дату.');
    }
    return $value;
}

// Время в виде 09:30.
function time_value($data, $field)
{
    $value = $data[$field] ?? null;
    if (!is_string($value) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value)) {
        invalid($field, 'Выберите время.');
    }
    return $value;
}

// Дата и время в виде 2026-11-27 14:30.
function datetime_value($data, $field)
{
    $value = $data[$field] ?? null;
    if (!is_string($value)) {
        invalid($field, 'Выберите время.');
    }
    $date = DateTime::createFromFormat('Y-m-d H:i', $value);
    if (!$date || $date->format('Y-m-d H:i') !== $value) {
        invalid($field, 'Выберите время.');
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

// Пароль от 8 до 72 байт. Больше 72 нельзя: bcrypt учитывает только первые 72 байта.
function password_value($data, $field = 'password')
{
    $password = $data[$field] ?? null;
    if (!is_string($password) || $password === '') {
        invalid($field, 'Введите пароль.');
    }
    if (strlen($password) < 8 || strlen($password) > 72) {
        invalid($field, 'Пароль должен быть от 8 символов (не больше 72 байт).');
    }
    return $password;
}

// Российский телефон. Принимаем любую запись (+7 999 123-45-67, 89991234567),
// оставляем цифры и храним в одном виде: +7 (999) 123-45-67.
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
    if (strlen($digits) === 10) {
        $digits = '7' . $digits;
    }
    if (strlen($digits) !== 11 || $digits[0] !== '7') {
        invalid($field, 'Введите номер целиком: +7 и ещё 10 цифр.');
    }
    return sprintf('+7 (%s) %s-%s-%s', substr($digits, 1, 3), substr($digits, 4, 3),
        substr($digits, 7, 2), substr($digits, 9, 2));
}

// Значение из списка разрешённых, например статус или зона столика.
function choice_value($data, $field, $allowed, $message = 'Выберите значение из списка.')
{
    $value = $data[$field] ?? null;
    if (!in_array($value, $allowed, true)) {
        invalid($field, $message);
    }
    return $value;
}
