<?php
// Меню: категории и позиции. Сайт видит всё, кроме скрытых позиций;
// позиции из стоп-листа (is_available = 0) видны, но помечены «нет в наличии».

// Иконки, которые умеет рисовать лендинг (см. ICONS в public/main.js).
const MENU_ICONS = ['cup', 'glass', 'tea', 'plate', 'egg', 'croissant', 'bun', 'bread'];
// Метки позиции. В базе хранятся через запятую: «хит,веган».
const MENU_TAGS = ['хит', 'веган', 'новинка'];

// Привести строку из базы к виду для браузера: числа — числами, метки — списком.
function menu_item_row($row)
{
    return [
        'id' => (int) $row['id'],
        'category_id' => (int) $row['category_id'],
        'category' => $row['category_code'] ?? null,
        'name' => $row['name'],
        'description' => $row['description'],
        'price' => (int) $row['price'],
        'size' => $row['size'],
        'icon' => $row['icon'],
        'tags' => $row['tags'] === null || $row['tags'] === '' ? [] : explode(',', $row['tags']),
        'is_available' => (bool) $row['is_available'],
        'is_hidden' => (bool) $row['is_hidden'],
        'sort' => (int) $row['sort'],
    ];
}

function list_categories()
{
    return query('SELECT id, code, name, sort FROM categories ORDER BY sort, id')->fetchAll();
}

// Меню для сайта: категории, в каждой — позиции по порядку. $withHidden — для админки.
function menu($withHidden = false)
{
    $where = $withHidden ? '' : 'WHERE m.is_hidden = 0';
    $rows = query("SELECT m.*, c.code AS category_code FROM menu_items m
        JOIN categories c ON c.id = m.category_id $where ORDER BY c.sort, m.sort, m.id")->fetchAll();
    $categories = [];
    foreach (list_categories() as $category) {
        $categories[$category['id']] = [
            'id' => (int) $category['id'],
            'code' => $category['code'],
            'name' => $category['name'],
            'items' => [],
        ];
    }
    foreach ($rows as $row) {
        $categories[$row['category_id']]['items'][] = menu_item_row($row);
    }
    return array_values($categories);
}

function find_menu_item($id)
{
    $row = query('SELECT m.*, c.code AS category_code FROM menu_items m
        JOIN categories c ON c.id = m.category_id WHERE m.id = ?', [$id])->fetch();
    if (!$row) {
        send_error(404, 'Позиция меню не найдена.');
    }
    return menu_item_row($row);
}

// --- Админка ---

// Добавить ($id = null) или изменить позицию меню.
function save_menu_item($data, $id = null)
{
    if ($id !== null) {
        find_menu_item($id); // 404, если такой нет
    }
    $categoryId = int_value($data, 'category_id', 1, PHP_INT_MAX);
    if (!query('SELECT id FROM categories WHERE id = ?', [$categoryId])->fetch()) {
        invalid('category_id', 'Выберите раздел меню.');
    }
    $name = text_value($data, 'name', 80);
    $description = optional_text_value($data, 'description', 255);
    $price = int_value($data, 'price', 1, 100000);
    $size = optional_text_value($data, 'size', 30);
    $icon = choice_value($data, 'icon', MENU_ICONS, 'Выберите значок.');
    $sort = int_value($data, 'sort', 0, 9999);
    $isHidden = bool_value($data, 'is_hidden');

    $tags = $data['tags'] ?? [];
    if (!is_array($tags)) {
        invalid('tags', 'Неверные метки.');
    }
    foreach ($tags as $tag) {
        if (!in_array($tag, MENU_TAGS, true)) {
            invalid('tags', 'Неизвестная метка.');
        }
    }
    $tagsText = implode(',', array_unique($tags));

    $values = [$categoryId, $name, $description, $price, $size, $tagsText, $icon, $isHidden ? 1 : 0, $sort];
    if ($id === null) {
        $id = insert('INSERT INTO menu_items (category_id, name, description, price, size, tags, icon, is_hidden, sort)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', $values);
    } else {
        $values[] = $id;
        query('UPDATE menu_items SET category_id = ?, name = ?, description = ?, price = ?, size = ?, tags = ?,
            icon = ?, is_hidden = ?, sort = ? WHERE id = ?', $values);
    }
    return find_menu_item($id);
}

// Стоп-лист: одна кнопка «в наличии / нет в наличии».
function set_menu_item_available($id, $data)
{
    find_menu_item($id);
    $available = bool_value($data, 'is_available');
    query('UPDATE menu_items SET is_available = ? WHERE id = ?', [$available ? 1 : 0, $id]);
    return find_menu_item($id);
}

// Удалить можно только позицию, которую ещё ни разу не заказывали.
// Иначе в старых заказах пропала бы ссылка — такую позицию только скрывают.
function delete_menu_item($id)
{
    find_menu_item($id);
    $used = query('SELECT 1 FROM order_items WHERE menu_item_id = ? LIMIT 1', [$id])->fetchColumn();
    if ($used) {
        send_error(409, 'Эту позицию уже заказывали, удалить её нельзя. Скройте её — с сайта она пропадёт, а старые заказы останутся как были.');
    }
    query('DELETE FROM menu_items WHERE id = ?', [$id]);
}
