import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Тот же алиас, что и в tsconfig.json — иначе сборка не найдёт модули
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // нужно, чтобы открывать dev-сборку с телефона и тестировать Telegram Mini App
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // Видео и тяжёлые фото не инлайним в бандл ни при каких условиях
    assetsInlineLimit: 4096,
  },
});
