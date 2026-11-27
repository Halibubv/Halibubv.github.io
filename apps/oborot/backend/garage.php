<?php
// Гараж клиента: его машины. Каждый запрос проверяет владельца (user_id = ?),
// поэтому чужую машину нельзя ни увидеть, ни изменить, ни удалить.

function list_cars($userId)
{
    $cars = query('SELECT c.id, c.brand, c.model, c.body, c.year, c.plate,
        (SELECT COUNT(*) FROM bookings b WHERE b.car_id = c.id AND b.starts_at > NOW()
            AND b.status IN (\'new\', \'confirmed\', \'in_work\')) AS future_bookings
        FROM cars c WHERE c.user_id = ? ORDER BY c.id', [$userId])->fetchAll();
    foreach ($cars as &$car) {
        $car['body_name'] = BODIES[$car['body']]['name'];
    }
    return $cars;
}

function find_own_car($userId, $carId)
{
    $car = query('SELECT id FROM cars WHERE id = ? AND user_id = ?', [$carId, $userId])->fetch();
    if (!$car) {
        send_error(404, 'Машина не найдена.');
    }
    return $car;
}

// Добавить машину ($carId = null) или изменить свою.
function save_car($userId, $data, $carId = null)
{
    if ($carId !== null) {
        find_own_car($userId, $carId);
    }
    $brand = text_value($data, 'brand', 60);
    if (!query('SELECT id FROM brands WHERE name = ?', [$brand])->fetchColumn()) {
        invalid('brand', 'Выберите марку из списка.');
    }
    $model = text_value($data, 'model', 60);
    $body = choice_value($data, 'body', array_keys(BODIES), 'Выберите тип кузова.');
    $year = optional_int_value($data, 'year', 1950, (int) date('Y') + 1);
    $plate = optional_text_value($data, 'plate', 15);
    if ($plate !== null) {
        $plate = mb_strtoupper($plate, 'UTF-8');
    }

    if ($carId === null) {
        $count = query('SELECT COUNT(*) FROM cars WHERE user_id = ?', [$userId])->fetchColumn();
        if ($count >= 10) {
            send_error(422, 'В гараже может быть не больше 10 машин.');
        }
        insert('INSERT INTO cars (user_id, brand, model, body, year, plate) VALUES (?, ?, ?, ?, ?, ?)',
            [$userId, $brand, $model, $body, $year, $plate]);
    } else {
        query('UPDATE cars SET brand = ?, model = ?, body = ?, year = ?, plate = ? WHERE id = ? AND user_id = ?',
            [$brand, $model, $body, $year, $plate, $carId, $userId]);
    }
    return list_cars($userId);
}

// Удалить можно только машину без будущих записей: иначе сервис не поймёт, какую машину ждать.
function delete_car($userId, $carId)
{
    find_own_car($userId, $carId);
    $future = query("SELECT COUNT(*) FROM bookings WHERE car_id = ? AND starts_at > NOW()
        AND status IN ('new', 'confirmed', 'in_work')", [$carId])->fetchColumn();
    if ($future > 0) {
        send_error(409, 'На эту машину есть будущие записи. Сначала отмените их.');
    }
    // У прошлых записей ссылка на машину станет пустой (ON DELETE SET NULL),
    // а марка и кузов в самой записи останутся.
    query('DELETE FROM cars WHERE id = ? AND user_id = ?', [$carId, $userId]);
}
