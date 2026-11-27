import { defineConfig } from 'vite';

// Кабинет и админка собираются в public/ui, PHP отдаёт их по адресам /login, /account, /admin.
// В режиме разработки (npm run dev, порт 5182) запросы /api уходят на PHP-сервер (порт 8092).
// При сборке файлы лежат в /ui/, а в режиме разработки — в корне, чтобы работали адреса /login, /account.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ui/' : '/',
  publicDir: false,
  server: {
    port: 5182,
    proxy: {
      '/api': 'http://127.0.0.1:8092',
      '/img': 'http://127.0.0.1:8092',
    },
  },
  build: { outDir: 'public/ui', emptyOutDir: true },
}));
