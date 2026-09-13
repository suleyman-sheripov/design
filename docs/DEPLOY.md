# Перенос изменений и публикация

Проверено 7 сентября 2026: репозиторий `suleyman-sheripov/design` публичный, основная ветка `main`; GitHub сообщает `has_pages: true`. Адрес https://suleyman-sheripov.github.io/design/ отвечает HTTP 200 с заголовком «Сулейман Шерипов — UI/UX Designer». Это другая версия страницы, не подготовленная React-сборка. Ни push, ни настройки удалённого репозитория агент не менял.

## 1. Забрать подготовленный коммит в исходный проект

Рабочая копия результата находится здесь:

`C:\Users\flerk\Documents\Codex\2026-09-07\files-pasted-by-the-user-ui\outputs\site-portfolio`

Исходный проект на рабочем столе остался нетронутым. В PowerShell:

```powershell
Set-Location 'C:\Users\flerk\Desktop\site-portfolio'
git status
git switch react
git fetch 'C:\Users\flerk\Documents\Codex\2026-09-07\files-pasted-by-the-user-ui\outputs\site-portfolio' react
git merge --ff-only FETCH_HEAD
npm ci --prefix app
npm test --prefix app
npm run build --prefix app
```

Если после начала этой работы ты менял отслеживаемые файлы или делал коммиты, сначала сохрани свои изменения. `--ff-only` безопасно остановится при расхождении истории; не заменяй его на reset. Неотслеживаемый `ЗАДАНИЕ-ДЛЯ-АГЕНТА.md` не затрагивается.

## 2. Настроить существующий Pages

В [Settings → Pages](https://github.com/suleyman-sheripov/design/settings/pages), в Build and deployment выбери **Source → GitHub Actions**. Если уже выбран — менять не нужно. В Settings → Actions → General разреши запуск используемых GitHub Actions, если он ограничен.

В Settings → Environments → github-pages проверь, что правило Deployment branches допускает `main`. Если есть required reviewers, первый deploy будет ждать твоего подтверждения.

## 3. Слить React-версию и отправить

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git merge react
git push origin main
git push origin v2-vanilla-final
```

Если git сообщает конфликт, остановись и разреши его; не выполняй принудительный push. Последняя команда сохраняет тег старой версии на сервере, если его там ещё нет.

Открой [Actions](https://github.com/suleyman-sheripov/design/actions), дождись зелёного **Deploy to GitHub Pages**. При необходимости открой этот workflow → Run workflow → main. Публикуется `app/dist`, подпуть берётся из имени репозитория. Ветка `react` проходит проверки, но не подменяет публичный сайт.

После первого развёртывания проверь:

- `/design/` — новое портфолио;
- `/design/admin/` — редактор;
- `/design/og.png` — превью ссылки;
- `https://raw.githubusercontent.com/suleyman-sheripov/design/main/content/data/site.json` — свежий контент.

GitHub/CDN и мессенджеры могут кешировать старую страницу или картинку. Для первого показа превью поделись ссылкой с `?v=react`, если мессенджер не обновляет кеш.

## 4. Личный токен редактора

[GitHub → Settings → Developer settings → Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new): Resource owner — твой аккаунт, Repository access — Only select repositories → `design`, Repository permissions → Contents → Read and write. Выбери срок действия. Никакие права Actions, Pages или администратора редактору не нужны. Токен вводится только в форме редактора, не в JSON, `.env` или команде Git.

Если `main` защищена обязательными PR, прямой коммит редактора будет отклонён. Для личного репозитория настрой правило так, чтобы владелец мог записывать в `main`, либо редактируй отдельную ветку и сливай PR вручную; сайт по умолчанию читает `main`.

## 5. Аналитика

Подготовлено подключение GoatCounter: просмотры страниц, открытие кейса, переход к контактам, email/телефон и внешние ссылки. Аккаунт и настоящий endpoint не выдуманы — счётчик **пока выключен**.

Создай свой сайт на [GoatCounter](https://www.goatcounter.com/), скопируй адрес `https://ТВОЙ-КОД.goatcounter.com/count` и запиши его в `app/public/site-config.json` → `analytics.goatcounter`. После push настройки попадут в новую сборку. На localhost, при Do Not Track и в админке счётчик не подключается. В custom events передаются только тип действия и slug кейса/домен внешней ссылки, без токена, адреса email или телефона посетителя. В рабочем браузере после публикации проверь поступление событий в свой кабинет.

## Если что-то не открылось

404 приложения — проверь успешный deploy, Source и подпуть `/design/`. 404 контента — в `main` ещё нет `content/data/site.json` либо неверны owner/repo/branch в `site-config.json`. 401 редактора — токен неверен или истёк. 403 — проверь доступ к `design`, Contents, лимит запросов и правила ветки. Конфликт при сохранении — скачай копию, перечитай свежую ветку и повтори правки.

Источники: [GitHub Pages и Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [источник публикации](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Git Trees API](https://docs.github.com/en/rest/git/trees), [GoatCounter JS](https://www.goatcounter.com/help/js), [правило Web Audio autoplay](https://developer.chrome.com/blog/web-audio-autoplay).
