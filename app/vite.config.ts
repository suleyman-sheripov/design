import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* Репозиторий называется design, поэтому Pages отдаёт сайт по
   адресу suleyman-sheripov.github.io/design/. Без подпути ссылки
   на стили и скрипты ушли бы в корень домена и не нашлись.

   SITE_BASE принимается голым именем, без косых черт: Git Bash на
   Windows принимает значение вида /design/ за путь и подставляет
   вместо него каталог установки Git. Слэши навешиваем здесь, где
   до значения не дотягивается ни одна оболочка. Пустое значение
   даёт корень домена — это для своего домена. */
function siteBase(): string {
  const raw = (process.env.SITE_BASE ?? 'design').replace(/^\/+|\/+$/g, '')
  return raw ? `/${raw}/` : '/'
}

export default defineConfig({
  base: siteBase(),
  plugins: [react(), tailwindcss()],
})
