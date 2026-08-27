# Roadmap на 6 недель — от нуля до уверенного junior'а

Пошаговый план, рассчитанный на **3-4 часа в день**. Бюджет недели:
- 7-10 часов теории (видео + чтение)
- 7-10 часов чтения чужого кода (твой Wesetup)
- 7-10 часов практики (мини-задачи руками)

Все ссылки проверь сам — интернет меняется. Если ссылка умерла —
гугли название курса целиком, обычно находится зеркало.

> **Главный спутник:** `index.html` рядом с этим файлом. Открой в
> браузере — там вся теория с примерами из твоего же проекта.

---

## Неделя 1 · Веб-основы и среда

**Что должно стать понятным к концу недели:**
- Что такое HTML/CSS/JS и зачем они нужны вместе.
- Запустить Wesetup локально (или принять решение работать только с прод).
- Свободно открывать любые файлы проекта в редакторе.
- Понимать, что такое браузер, DevTools, и как просматривать запросы.

### Теория (8 ч)

| Ресурс | Что взять | Время |
|---|---|---|
| [HTML Academy — Базовый HTML/CSS](https://htmlacademy.ru/courses/html-css) | Бесплатные тренажёры | 4 ч |
| [MDN — Изучение веб-разработки](https://developer.mozilla.org/ru/docs/Learn) | Раздел «Начало работы с вебом» | 2 ч |
| [Doka.guide — Веб](https://doka.guide/) | Раздел HTML, главные теги | 1 ч |
| [Wesetup Codex — Глава III](./index.html#ch-3) | Web-основы за вечер | 1 ч |

### Чтение кода Wesetup (5 ч)

1. Открой `package.json` — посмотри список зависимостей. Каждое
   незнакомое слово вбей в гугл («что такое X»).
2. Открой `CLAUDE.md` — это инструкция для AI-ассистента, но в ней
   суть всей архитектуры.
3. Пройди по папкам в `src/app/` — найди где лежит главная
   страница, страница логина, любой API.

### Практика (5 ч)

- [ ] Сделай личную HTML-страницу «обо мне». Цвета, картинка, ссылки.
- [ ] Открой 5 страниц Wesetup в DevTools (F12):
  - Вкладка Network — посмотри какие запросы идут.
  - Вкладка Console — попробуй `document.querySelectorAll('button')`.
  - Вкладка Elements — посмотри DOM.
- [ ] Установи VS Code, расширение «Russian Language Pack» и
  «Prettier». Открой проект Wesetup.

### Полезные клавиши VS Code

| Действие | Клавиша |
|---|---|
| Поиск по всем файлам | `Ctrl + Shift + F` |
| Перейти к файлу по имени | `Ctrl + P` |
| Перейти к функции | `Ctrl + Shift + O` |
| Свернуть/развернуть код | `Ctrl + K + 0..4` |
| Переименовать переменную везде | `F2` |
| Перейти к определению | `F12` |

---

## Неделя 2 · JavaScript + TypeScript

**Что должно стать понятным к концу недели:**
- Свободно читать JS-код, понимать `async/await`.
- Работать с массивами через `map/filter/reduce`.
- Читать TypeScript-сигнатуры функций.
- Понимать, зачем типы.

### Теория (10 ч)

| Ресурс | Что взять | Время |
|---|---|---|
| [learn.javascript.ru](https://learn.javascript.ru/) | Главы 1-7 (Введение → Объекты) | 5 ч |
| [learn.javascript.ru — Promises и async/await](https://learn.javascript.ru/async) | Вся глава | 2 ч |
| [Learn X in Y — TypeScript](https://learnxinyminutes.com/typescript/) | Целиком | 30 мин |
| [TypeScript Handbook (RU)](https://typescript-handbook.ru/) | Раздел «Базовые типы» | 2 ч |
| [Wesetup Codex — Глава IV](./index.html#ch-4) | TypeScript на практике | 30 мин |

### YouTube (бонус, на любителя)

- [Уеб Дев Симплифайд (англ)](https://www.youtube.com/@WebDevSimplified) — «Learn JavaScript in 1 hour».
- [Илья Кантор — YouTube канал](https://www.youtube.com/@ilyakantor) — автор learn.javascript.ru.
- [Лёша Чичерин — Frontend](https://www.youtube.com/@frontendcamp) — на русском.

### Чтение кода Wesetup (7 ч)

1. `src/lib/role-access.ts` — прочитай построчно, объясни вслух каждую функцию.
2. `src/lib/auth-helpers.ts` — особенно `getActiveOrgId` и почему её нужно использовать.
3. `src/lib/journal-acl.ts` — посмотри как сделан LRU-кэш.
4. `src/lib/validators.ts` — посмотри как описаны Zod-схемы.

### Практика (7 ч)

- [ ] Напиши скрипт `count.ts`, который:
  - Принимает путь к JSON-файлу.
  - Читает его (используй `fs.promises.readFile`).
  - Считает сколько в массиве объектов, сколько с полем `active: true`.
  - Выводит результат.
  - Запусти через `npx tsx count.ts data.json`.
- [ ] В Wesetup найди функцию, которая тебя смущает. Напиши на бумажке
  «что она делает» своими словами. Сравни с реальностью.
- [ ] Открой любой `*.test.ts` файл в Wesetup и попробуй понять,
  что тестируется.

---

## Неделя 3 · React и Next.js

**Что должно стать понятным к концу недели:**
- Пишешь свои React-компоненты с `useState` и `useEffect`.
- Отличаешь Server Components от Client Components.
- Знаешь, как добавить новую страницу и новый API endpoint.
- Понимаешь, как фронт общается с бэком через `fetch`.

### Теория (10 ч)

| Ресурс | Что взять | Время |
|---|---|---|
| [react.dev — Учим React (RU)](https://ru.react.dev/learn) | Раздел «Quick Start» + «Tutorial: Tic-Tac-Toe» | 4 ч |
| [react.dev — Thinking in React](https://ru.react.dev/learn/thinking-in-react) | Целиком | 1 ч |
| [Next.js Learn — Official](https://nextjs.org/learn) | App Router course | 4 ч |
| [Wesetup Codex — Глава V](./index.html#ch-5) | React и Next.js | 1 ч |

### Бонус (видео, англ)

- [Theo - t3.gg](https://www.youtube.com/@t3dotgg) — много про Next.js и современный TS-стек.
- [Lee Robinson (Vercel)](https://www.youtube.com/@leerob) — официальный евангелист Next.js.

### Чтение кода Wesetup (7 ч)

1. `src/app/(dashboard)/dashboard/page.tsx` — типичная страница.
2. `src/app/(dashboard)/journals/[code]/page.tsx` — динамический маршрут.
3. `src/app/api/journals/route.ts` — API endpoint (мы его уже разбирали).
4. `src/components/journals/dynamic-form.tsx` — большой Client-компонент.

### Практика (8 ч)

- [ ] Сделай страницу `/scratch/page.tsx` в Wesetup:
  - Server Component — показывает «Привет, {имя из сессии}».
  - Client-компонент с кнопкой-счётчиком (useState).
- [ ] Сделай API `src/app/api/scratch/route.ts`:
  - GET возвращает `{ now: new Date().toISOString() }`.
- [ ] Свяжи: на странице scratch добавь кнопку, которая дёргает API и
  показывает результат через `fetch`.
- [ ] Удали свои страницы перед коммитом — это была тренировка.

---

## Неделя 4 · База данных и Prisma

**Что должно стать понятным к концу недели:**
- Читаешь `schema.prisma` и понимаешь связи между моделями.
- Пишешь Prisma-запросы (findMany, create, update, include, where).
- Открываешь данные в Prisma Studio.
- Понимаешь, что такое мульти-тенантность и почему важен `organizationId`.

### Теория (8 ч)

| Ресурс | Что взять | Время |
|---|---|---|
| [SQL за 30 минут (Stepik)](https://stepik.org/course/63054) | Бесплатный курс | 3 ч |
| [Prisma Docs — Getting Started](https://www.prisma.io/docs/getting-started) | Quickstart + CRUD | 3 ч |
| [Prisma Docs — Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) | One-to-many, many-to-many | 1 ч |
| [Wesetup Codex — Глава VI](./index.html#ch-6) | База данных и Prisma | 1 ч |

### Чтение кода Wesetup (8 ч)

1. `prisma/schema.prisma` — выбери одну модель (например, `User`),
   разберись с каждым полем и каждой связью.
2. Найди в API-роутах примеры `db.user.findMany`, `db.user.create`.
3. Найди как делается фильтрация по `organizationId` в реальных запросах.

### Практика (6 ч)

- [ ] Установи Prisma Studio: `npx prisma studio`. Открой 3 таблицы,
  посмотри глазами на реальные данные.
- [ ] Напиши Node-скрипт, который:
  - Подключается к Wesetup-БД (через `import { db } from "@/lib/db"`).
  - Считает сколько `User` в каждой организации.
  - Выводит топ-5 самых больших организаций.
  - Запусти через `npx tsx my-script.ts`.
- [ ] Изучи команду `npx prisma format` — она форматирует схему.

### Прокачка по SQL (для будущего)

- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) — справочник по SQL.
- [pgexercises.com](https://pgexercises.com/) — задачи по SQL.

---

## Неделя 5 · Серверная сторона + Docker

**Что должно стать понятным к концу недели:**
- Заходишь по SSH, читаешь логи, перезапускаешь PM2.
- Понимаешь, что nginx делает между интернетом и приложением.
- Запустил контейнер Postgres локально через Docker.
- Понимаешь, когда Docker нужен, а когда — нет.

### Теория (10 ч)

| Ресурс | Что взять | Время |
|---|---|---|
| [learnshell.org](https://www.learnshell.org/) | Basic shell в браузере | 2 ч |
| [Linux Journey](https://linuxjourney.com/) | Grasshopper + Networking Nomad | 3 ч |
| [Docker Docs — Get Started](https://docs.docker.com/get-started/) | Modules 1-4 | 3 ч |
| [docker-curriculum.com](https://docker-curriculum.com/) | На русском есть переводы | 1 ч |
| [Wesetup Codex — Главы VII-VIII](./index.html#ch-7) | Серверная + Docker | 1 ч |

### Видео-курсы (бонус)

- [Денис Иксанов — «DevOps с нуля»](https://www.youtube.com/results?search_query=denis+iksanov+docker) (поищи на YouTube).
- [TechWorld with Nana](https://www.youtube.com/@TechWorldwithNana) — «Docker tutorial for beginners» (англ).

### Чтение конфигов Wesetup (5 ч)

1. `.github/workflows/deploy.yml` — pipeline автодеплоя.
2. `CLAUDE.md` — секция «Production Server» и «Useful production checks».
3. `scripts/deploy.sh` — если есть скрипт ручного деплоя.

### Практика (7 ч)

- [ ] Зайди по SSH на прод Wesetup:
  ```bash
  ssh -p 50222 wesetupru@wesetup.ru
  pm2 status haccp-online
  pm2 logs haccp-online --lines 50
  ```
- [ ] Установи [Docker Desktop](https://www.docker.com/products/docker-desktop) на свою машину.
- [ ] Запусти локальный Postgres:
  ```bash
  docker run -d --name pg -p 5432:5432 \
    -e POSTGRES_PASSWORD=secret postgres:16
  ```
- [ ] Подключись к нему через [DBeaver](https://dbeaver.io/) (бесплатный GUI для БД).
- [ ] Напиши свой Dockerfile для маленького Node-проекта:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  CMD ["npm", "start"]
  ```
- [ ] Собери и запусти: `docker build -t my-app . && docker run -p 3000:3000 my-app`.

---

## Неделя 6 · Python + железо

**Что должно стать понятным к концу недели:**
- Знаешь синтаксис Python, пишешь простые скрипты.
- Используешь pip и venv.
- Понимаешь, как открыть COM-порт и обменяться данными.
- Можешь напечатать чек на ESC/POS-принтере (или эмуляторе).

### Теория (8 ч)

| Ресурс | Что взять | Время |
|---|---|---|
| [Stepik — Python для начинающих](https://stepik.org/course/67) | Бесплатный курс, базовый | 4 ч |
| [Python — Official Tutorial (RU)](https://docs.python.org/3/tutorial/) | Главы 1-5 | 2 ч |
| [python-escpos docs](https://python-escpos.readthedocs.io/) | User guide | 1 ч |
| [pyserial docs](https://pyserial.readthedocs.io/en/latest/shortintro.html) | Short intro | 30 мин |
| [Wesetup Codex — Глава IX](./index.html#ch-9) | Python и железо | 30 мин |

### YouTube (на любителя)

- [Sentdex](https://www.youtube.com/@sentdex) — англ, много про Python и автоматизацию.
- [Хауди Хо!](https://www.youtube.com/@howdyho_official) — на русском, есть Python-серии.

### Чтение документации по железу

- [АТОЛ Драйвер 10.x — документация](https://www.atol.ru/company/service-support/documents/) — официальные доки.
- [Кассовое ПО — kkmserver](https://kkmserver.ru/KkmServer) — HTTP-обёртка над любой кассой.
- [Список ESC/POS-команд](https://reference.epson-biz.com/modules/ref_escpos/index.php) — Epson reference.

### Практика (10 ч)

- [ ] Установи Python 3.12+ ([python.org](https://www.python.org/downloads/)).
- [ ] Создай папку `printer-test/`, в ней:
  ```bash
  python -m venv venv
  venv\Scripts\activate   # Windows
  pip install python-escpos pyserial flask
  ```
- [ ] Напиши `csv2json.py`:
  - Читает CSV (используй модуль `csv`).
  - Сохраняет в JSON (модуль `json`).
- [ ] Напиши `printer_server.py` — Flask-сервер, эмулятор принтера:
  ```python
  from flask import Flask, request, jsonify
  app = Flask(__name__)

  @app.route("/print", methods=["POST"])
  def print_receipt():
      with open("receipts.log", "a", encoding="utf-8") as f:
          f.write(request.json["text"] + "\n---\n")
      return jsonify({"ok": True})

  app.run(host="127.0.0.1", port=5000)
  ```
- [ ] Если есть реальный термопринтер — напечатай тестовый чек.

---

## После шестой недели — реальная задача

Возьми **маленькую реальную задачу** из бэклога Wesetup. Не пытайся
сразу строить большую фичу. Хороший первый таск:

- Добавить новый фильтр в существующий список.
- Добавить колонку в таблицу с данными.
- Добавить чекбокс в форму и сохранять его значение.
- Поправить вёрстку на мобильных.
- Добавить tooltip к кнопке.

Полный путь:
1. **Понять задачу.** Перечитать TZ, открыть файлы, нарисовать на
   бумажке как это должно выглядеть.
2. **Найти где править.** Через `Ctrl+Shift+F` найти ближайший
   похожий код. Скопировать паттерн.
3. **Написать.** Маленькими шагами. После каждого — проверять что
   ничего не сломалось.
4. **Запустить локально.** Открыть страницу, потыкать руками.
5. **Закоммитить и запушить.** Сообщение на русском, как принято.
6. **Проверить на проде** через 3 минуты после push (CI/CD сам задеплоит).
7. **Поймать баг.** Поправить. Запушить ещё раз.

После 3-4 таких задач — ты junior.

---

## Постоянные референсы (хранить под рукой)

### Документации
- [MDN Web Docs](https://developer.mozilla.org/ru/) — HTML/CSS/JS, лучшая дока.
- [react.dev](https://ru.react.dev/) — React.
- [nextjs.org/docs](https://nextjs.org/docs) — Next.js.
- [prisma.io/docs](https://www.prisma.io/docs) — Prisma.
- [tailwindcss.com/docs](https://tailwindcss.com/docs) — Tailwind.
- [docs.python.org](https://docs.python.org/3/) — Python.

### Roadmaps и карьерные пути
- [roadmap.sh](https://roadmap.sh/) — карьерные roadmaps по всем стекам.
- [The Odin Project](https://www.theodinproject.com/) — бесплатный full-stack курс.
- [freeCodeCamp](https://www.freecodecamp.org/) — бесплатные сертификации.

### Поиск ошибок
- [Stack Overflow](https://stackoverflow.com/) — основной источник ответов.
- [GitHub Issues](https://github.com/) — баги конкретных библиотек.
- [Доке.guide](https://doka.guide/) — русскоязычный справочник по вебу.

### Кодинг практика
- [Exercism](https://exercism.org/) — задачки на 60+ языках, бесплатно.
- [Codewars](https://www.codewars.com/) — короткие задачи по сложности.
- [LeetCode](https://leetcode.com/) — для алгоритмических собеседований.

### Безопасность (когда будешь сильнее)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) — главные веб-уязвимости.
- [PortSwigger Web Security Academy](https://portswigger.net/web-security) — бесплатный курс по веб-безопасности.

### Git
- [Pro Git Book (RU)](https://git-scm.com/book/ru/v2) — официальная книга бесплатно.
- [Oh Shit, Git!](https://ohshitgit.com/ru) — как откатиться из любой ситуации.

### YouTube (русскоязычные)
- [WebForMyself](https://www.youtube.com/@WebForMySelf_chanel)
- [Сергей Лужников](https://www.youtube.com/@sergeyluzhnikov)
- [Yauhen Kavalchuk](https://www.youtube.com/@YauhenKavalchuk) — мега-объём по React/JS.
- [#extended](https://www.youtube.com/@extendedrussian)

### YouTube (англоязычные)
- [Fireship](https://www.youtube.com/@Fireship) — короткие обзоры технологий.
- [Theo - t3.gg](https://www.youtube.com/@t3dotgg) — современный JS-стек.
- [Net Ninja](https://www.youtube.com/@NetNinja) — структурированные курсы.
- [Web Dev Simplified](https://www.youtube.com/@WebDevSimplified)
- [Traversy Media](https://www.youtube.com/@TraversyMedia)
- [ThePrimeagen](https://www.youtube.com/@ThePrimeagen) — про код, vim, культуру.

### AI-ассистенты для кода
- [Claude.ai](https://claude.ai/) — общий чат, лучший для длинных диалогов.
- [Claude Code](https://claude.com/claude-code) — CLI, прямо в твоём редакторе.
- [Cursor](https://cursor.sh/) — редактор с AI внутри.
- [GitHub Copilot](https://github.com/features/copilot) — автодополнение в IDE.

---

## Правила, которые помогут не сгореть

1. **Не пытайся выучить «всё».** Невозможно. Выучи 20% инструментов,
   которыми пользуется 80% разработчиков.
2. **Пиши код каждый день.** Лучше 30 минут каждый день, чем 5 часов
   раз в неделю.
3. **Гугли на английском.** Русскоязычные туториалы часто устаревшие
   и не покрывают свежие версии.
4. **Не копируй из ChatGPT/Claude бездумно.** AI ошибается часто. Если
   не понимаешь что он написал — попроси объяснить, и проверь руками.
5. **Читай чужой код.** Это самый недооценённый навык. 80% работы
   junior'а — это понять, что уже написано до тебя.
6. **Веди заметки.** То, что выучил сегодня, через неделю забудешь.
   Простой markdown-файл с твоими «эврика»-моментами окупится.
7. **Делай маленькие коммиты.** Один логический шаг = один коммит.
   Это и для тебя удобнее, и для ревьюера, и для отката.
8. **Если что-то не работает — читай ошибку.** Целиком. Не первую
   строку. Не «что-то красное». А весь stack trace до конца.
9. **Не бойся ошибаться в Git.** Почти всё откатывается. Главное —
   не делай `--force` без понимания.
10. **Спрашивай.** Лучше спросить и показать, что чего-то не понял,
    чем три дня биться головой и сделать не то.

---

## Где найти ответ, если застрял

В таком порядке:

1. **Ошибка из консоли** — скопируй её целиком в гугл.
2. **Документация** — официальная (MDN, react.dev, prisma.io).
3. **Stack Overflow** — найди вопрос или задай свой (по-английски).
4. **GitHub Issues** библиотеки — может, это известный баг.
5. **AI-чат (Claude/ChatGPT)** — опиши проблему + что уже пробовал.
6. **Спроси у коллеги** — но сначала формализуй вопрос:
   - Что ты делал?
   - Что ожидал?
   - Что произошло?
   - Что уже попробовал?

Не пиши «ничего не работает». Никто не сможет помочь по такому
описанию.

---

*Этот roadmap — не закон. Если на третьей неделе понял, что хочется
глубже в Python — иди в Python, отложи React. Главное — двигаться.*
