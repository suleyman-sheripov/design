# Заставка: раскрытие букв и электронный звук — 30 октября 2026

Вместо общей прямоугольной маски ERIPOV появляется шестью полными силуэтами: небольшой поворот, раскрытие по ширине и короткое торможение. Входы следуют за точкой, чтобы она не перекрывала собранные буквы. Исходные SVG-контуры и просветы R/P/O сохранены. Рисование S, построение H и переход в шапку сохранены.

Новый звук — синтез фазовой модуляцией, последовательность шести электронных нот в моменты появления букв и завершающий открытый аккорд. Без шумовых записей и имитации предметных звуков. 48 kHz stereo, peak −10.84 dBFS; звук включается только по нажатию пользователя.

«Смотреть заставку» и «Со звуком» перенесены после колофона, в самый конец главной страницы. После повтора восстанавливаются прокрутка и фокус кнопки.

## Проверка

- `npm test --prefix app`, `npm run lint --prefix app`, `npm run build --prefix app`, `npm run check:content --prefix app`.
- `python app/scripts/check-site-polish.py http://localhost:4180/design/ /tmp/site-check` — desktop 1440×900 и touch 390×844; положение кнопок, возврат прокрутки/фокуса, реальные AudioBufferSource, остановка звука, форма, контакты, reduced motion и отказ AudioContext. Результаты в `interactions.json`.
- `python app/scripts/check-logo-motion.py http://localhost:4180/design/ /tmp/motion-check` — переход в шапку, пропуск, аварийный таймер, case/admin, сравнение контуров. Отдельные SVG-path дают небольшое отличие сглаживания края (максимум 7/255), итоговый собранный кадр использует оригинальный цельный path.
- Кадры движения — `sequence.jpg`; кнопки на телефоне — `footer-390.png`. Предупреждение о сохранённом контенте на локальном снимке связано с недоступностью удалённого запроса из тестового браузера.

## Просмотр и воспроизведение экспорта

- Сайт: https://suleyman-sheripov.github.io/design/
- Автономный просмотр: https://suleyman-sheripov.github.io/design/brand-motion/
- Видео: https://suleyman-sheripov.github.io/design/brand-motion/SHERIPOV-motion-with-sound.mp4

`node app/scripts/export-logo-motion.mjs` собирает автономный HTML. После сборки и запуска preview команда `python app/scripts/export-logo-video.py` рендерит реальную SVG-анимацию в Chromium и экспортирует оба MP4 (1920×1080, 60 fps, 5 секунд). Нужны Playwright, Chromium и ffmpeg. Звук берётся из того же синтезатора, что на сайте.
