-- Таблицы приложения ОБОРОТ. Кодировка utf8mb4, чтобы хранились русские буквы и эмодзи.

-- Пользователи: клиенты и администраторы. Пароль хранится только как хэш (bcrypt).
-- is_demo = 1 — демо-аккаунт, его пересоздаёт database/seed-demo.php.
CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL DEFAULT '',
    role ENUM('client', 'admin') NOT NULL DEFAULT 'client',
    is_demo TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Неудачные попытки входа: по ним считается лимит 5 на email + IP и 20 на IP за 15 минут.
CREATE TABLE login_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY login_attempts_email_ip (email, ip, attempted_at),
    KEY login_attempts_ip_time (ip, attempted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Гараж клиента. Марка хранится названием из справочника brands.
CREATE TABLE cars (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    brand VARCHAR(60) NOT NULL,
    model VARCHAR(60) NOT NULL,
    body ENUM('sedan', 'cross', 'suv') NOT NULL,
    year SMALLINT NULL,
    plate VARCHAR(15) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cars_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Прайс. code — латинский код услуги, по нему лендинг выбирает значок.
-- Скрытая услуга (is_active = 0) не видна на сайте, но остаётся в старых записях.
CREATE TABLE services (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    base_price INT NOT NULL,
    hours DECIMAL(4, 2) NOT NULL,
    sort INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY services_code (code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Марки машин. Премиум-марка дороже на 15 %.
CREATE TABLE brands (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    is_premium TINYINT(1) NOT NULL DEFAULT 0,
    sort INT NOT NULL DEFAULT 0,
    UNIQUE KEY brands_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Настройки сервиса: posts — число постов, open_hour и close_hour — часы работы.
CREATE TABLE settings (
    `key` VARCHAR(40) NOT NULL PRIMARY KEY,
    value VARCHAR(255) NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Записи на сервис. user_id пустой у гостя, car_id — если выбрана машина из гаража.
-- Цена и длительность посчитаны сервером на момент записи: subtotal — сумма услуг,
-- discount — скидка в рублях, total — итог, hours — длительность работ.
-- Пост занят с starts_at до ends_at (длительность, округлённая вверх до часа).
CREATE TABLE bookings (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    car_id INT NULL,
    brand VARCHAR(60) NOT NULL,
    body ENUM('sedan', 'cross', 'suv') NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    comment VARCHAR(500) NULL,
    subtotal INT NOT NULL,
    discount INT NOT NULL DEFAULT 0,
    total INT NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    status ENUM('new', 'confirmed', 'in_work', 'done', 'cancelled', 'no_show') NOT NULL DEFAULT 'new',
    is_demo TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY bookings_time (starts_at, ends_at),
    KEY bookings_status (status, starts_at),
    CONSTRAINT bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT bookings_car FOREIGN KEY (car_id) REFERENCES cars (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Услуги записи — снимок на момент записи: название, цена и часы не меняются вместе с прайсом.
-- ON DELETE RESTRICT: услугу из прайса, которая есть в записях, удалить нельзя (только скрыть).
CREATE TABLE booking_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    service_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    hours DECIMAL(4, 2) NOT NULL,
    CONSTRAINT booking_items_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT booking_items_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- История статусов записи: кто и когда сменил. user_id пустой, если записался гость.
CREATE TABLE booking_events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    status ENUM('new', 'confirmed', 'in_work', 'done', 'cancelled', 'no_show') NOT NULL,
    user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_events_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT booking_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
