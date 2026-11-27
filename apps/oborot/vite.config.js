import { defineConfig } from 'vite';

// Кабинет и админка собираются в public/ui, страницы открываются по адресам /account, /admin...
// В режиме разработки (npm run dev, порт 5181) запросы к API и файлы лендинга идут к PHP на 8091.
export default defineConfig({
  base: '/ui/',
  publicDir: false,
  server: {
    port: 5181,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8091',
      '/img': 'http://127.0.0.1:8091',
    },
  },
  build: { outDir: 'public/ui', emptyOutDir: true },
});
