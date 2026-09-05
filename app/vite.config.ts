import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* base: репозиторий называется design, поэтому Pages отдаёт сайт
   по адресу suleyman-sheripov.github.io/design/. Без подпути
   собранные ссылки на стили и картинки ушли бы в корень домена
   и не нашлись. Переопределяется переменной окружения, чтобы тот
   же код собирался и под свой домен. */
export default defineConfig({
  base: process.env.SITE_BASE ?? '/design/',
  plugins: [react(), tailwindcss()],
})
