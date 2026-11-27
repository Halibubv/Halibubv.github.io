-- Таблицы Пенки. Все InnoDB (внешние ключи и транзакции) и utf8mb4 (русский текст).
-- Деньги — целые рубли: копеек в меню кофейни нет.

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    role ENUM('client', 'admin') NOT NULL DEFAULT 'client',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Неудачные попытки входа: по ним считается лимит (backend/auth.php).
CREATE TABLE login_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY login_attempts_pair (email, ip),
    KEY login_attempts_ip (ip),
    KEY login_attempts_time (attempted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(60) NOT NULL,
    sort SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY categories_code (code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- is_available = 0 — стоп-лист (видна на сайте, но заказать нельзя);
-- is_hidden = 1 — скрыта с сайта совсем. icon — значок на лендинге.
CREATE TABLE menu_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    price INT UNSIGNED NOT NULL,
    size VARCHAR(30) NULL,
    tags VARCHAR(100) NOT NULL DEFAULT '',
    icon VARCHAR(20) NOT NULL DEFAULT 'cup',
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    is_hidden TINYINT(1) NOT NULL DEFAULT 0,
    sort SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT menu_items_category FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT menu_items_price CHECK (price > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE cafe_tables (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    seats TINYINT UNSIGNED NOT NULL,
    zone ENUM('window', 'sofa', 'big') NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY cafe_tables_label (label),
    CONSTRAINT cafe_tables_seats CHECK (seats BETWEEN 1 AND 12)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- weekday: 0 — воскресенье … 6 — суббота. opens и closes NULL — выходной.
CREATE TABLE opening_hours (
    weekday TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    opens TIME NULL,
    closes TIME NULL,
    CONSTRAINT opening_hours_day CHECK (weekday <= 6),
    CONSTRAINT opening_hours_order CHECK (opens IS NULL OR closes > opens)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Бронь: user_id NULL — бронировал гость без аккаунта.
CREATE TABLE reservations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    table_id INT UNSIGNED NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    guests TINYINT UNSIGNED NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    comment VARCHAR(300) NULL,
    status ENUM('new', 'confirmed', 'seated', 'closed', 'cancelled', 'no_show') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY reservations_table_time (table_id, starts_at),
    KEY reservations_time (starts_at),
    KEY reservations_user (user_id),
    CONSTRAINT reservations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT reservations_table FOREIGN KEY (table_id) REFERENCES cafe_tables (id),
    CONSTRAINT reservations_period CHECK (ends_at > starts_at),
    CONSTRAINT reservations_guests CHECK (guests BETWEEN 1 AND 12)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    comment VARCHAR(300) NULL,
    ready_at DATETIME NOT NULL,
    total INT UNSIGNED NOT NULL,
    status ENUM('new', 'accepted', 'ready', 'issued', 'cancelled') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY orders_status (status),
    KEY orders_ready (ready_at),
    KEY orders_user (user_id),
    CONSTRAINT orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Снимок позиции на момент заказа: название и цена не меняются, если потом поменяют меню.
-- RESTRICT: позицию, которую заказывали, нельзя удалить из меню, только скрыть.
CREATE TABLE order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    menu_item_id INT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    price INT UNSIGNED NOT NULL,
    qty TINYINT UNSIGNED NOT NULL,
    CONSTRAINT order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE RESTRICT,
    CONSTRAINT order_items_qty CHECK (qty BETWEEN 1 AND 20)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Журнал смены статусов: кто и когда принял заказ, подтвердил бронь и т. д.
CREATE TABLE status_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity ENUM('order', 'reservation') NOT NULL,
    entity_id INT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL,
    user_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY status_events_entity (entity, entity_id),
    CONSTRAINT status_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
