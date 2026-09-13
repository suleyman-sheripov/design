# Портфолио Сулеймана Шерипова

Рабочая версия: `app/`, React 19 + TypeScript + Vite + Tailwind 4 + Motion.
Сайт: https://suleyman-sheripov.github.io/design/ · Редактор: `/design/admin/`.

```sh
npm ci --prefix app
npm run dev --prefix app
```

Открыть `http://localhost:5173/design/`. Редактор доступен по `/design/admin/`. На localhost есть локальный черновик без публикации; вход с токеном сохраняет в GitHub. Инструкция: [Админка](docs/ADMIN.md).

```sh
npm test --prefix app
npm run lint --prefix app
npm run build --prefix app
```

Контент живёт в `content/data/site.json`, изображения — в `content/work/`. Сайт и админка используют один источник. В production JSON читается с публичной ветки `main` через raw.githubusercontent.com. Обновление контента не требует сборки React. Для первого показа JSON и изображения включены прямо в сборку. Локально сайт не запрашивает JSON отдельным HTTP-запросом; в production свежая версия из GitHub обновляет уже видимое содержимое. Ошибка обновления сохраняет рабочую витрину. `app/public/content/` — служебная копия, не редактировать и не коммитить.

- [Первый запуск и перенос изменений](docs/DEPLOY.md).
- [Как править работы и подготовить изображения](docs/CONTENT.md).
- [Устройство дизайна](DESIGN.md).
- [Проверки и ограничения](docs/VERIFICATION.md).

Старая версия сохранена в истории и под тегом `v2-vanilla-final`. Исходные PNG, старые CSS/JS и дубликаты удалены только из текущего дерева. История Git не переписывалась.

Кейсы открываются отдельными страницами с адресами вида `/design/#/work/beautylab`. Они работают при прямом открытии, обновлении и навигации назад/вперёд на GitHub Pages.
