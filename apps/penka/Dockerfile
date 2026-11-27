# Образ для бесплатного деплоя на Render (сервис penka в корневом render.yaml).
# Два этапа: сначала Node собирает React-кабинет и админку, потом в образ с PHP
# копируется только результат сборки. Node в итоговом образе не нужен.

# --- Этап 1: сборка интерфейса в public/ui ---
FROM node:22-slim AS ui
WORKDIR /app
# Сначала только файлы зависимостей: если они не менялись, Docker возьмёт этот шаг из кэша.
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# --- Этап 2: PHP-сервер ---
FROM php:8.4-cli
# pdo_mysql — драйвер MySQL для PDO. Дополнительные системные пакеты ему не нужны.
RUN docker-php-ext-install pdo_mysql

WORKDIR /app
COPY backend ./backend
COPY database ./database
COPY public ./public
COPY router.php start.sh ./
COPY --from=ui /app/public/ui ./public/ui
# chmod — на случай, если файл пришёл из Windows без права на запуск;
# sed убирает возможные окончания строк Windows (\r), с ними sh не запустит скрипт.
RUN chmod +x start.sh && sed -i 's/\r$//' start.sh

# Время по Москве и для PHP, и для журнала сервера.
ENV TZ=Europe/Moscow
# Встроенный сервер PHP с четырьмя процессами, чтобы один медленный запрос не держал остальных.
ENV PHP_CLI_SERVER_WORKERS=4
# Render сам передаёт PORT; 8080 — значение для запуска на своём компьютере.
ENV PORT=8080
EXPOSE 8080

# Не запускаем сервер от root.
USER www-data
CMD ["./start.sh"]
