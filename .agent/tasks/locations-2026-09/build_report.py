# -*- coding: utf-8 -*-
"""Собирает HTML-отчёт дыма по точкам со встроенными скриншотами."""
import base64
import io
import json
import os

DIR = os.path.dirname(os.path.abspath(__file__))
SMOKE = os.path.join(DIR, "smoke")
OUT = os.path.join(DIR, "smoke-report.html")


def img(name):
    path = os.path.join(SMOKE, name + ".png")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")


def figure(name, caption, kind="desktop"):
    src = img(name)
    if not src:
        return f'<figure class="shot {kind} missing"><div class="ph">нет снимка</div><figcaption>{caption}</figcaption></figure>'
    return (f'<figure class="shot {kind}"><button type="button" class="zoom" data-src="{src}" aria-label="Открыть крупно: {caption}">'
            f'<img src="{src}" alt="{caption}" loading="lazy"></button><figcaption><span class="num">{name[:2]}</span>{caption}</figcaption></figure>')


smoke = json.load(io.open(os.path.join(DIR, "e2e", "smoke-results.json"), encoding="utf-8"))
fits = smoke["fits"]

DESKTOP = [
    ("01-desktop-one-location-journals", "Одна точка: режим выключен, пилюли точки в шапке нет"),
    ("02-desktop-settings-toggle-off", "Настройки: тумблер выключен (третья точка в списке — след первого прогона, удалена)"),
    ("03-desktop-two-locations-journals", "Две точки: пилюля «E2E Точка А» рядом с организацией"),
    ("04-desktop-location-menu", "Меню точек с адресами и отметкой активной"),
    ("05-desktop-journals-hub", "Хаб журналов: бейджи «заполнено» считаются для активной точки"),
    ("06-desktop-dashboard", "Дашборд: «сегодня» для активной точки, отдельной сводки по точкам нет"),
    ("07-desktop-document-header", "Шапка документа: организация · точка, адрес"),
    ("08-desktop-settings-toggle-on", "Настройки: тумблер включён, подпись поясняет режим"),
    ("09-desktop-settings-hub", "Хаб настроек: плитка «Точки и помещения»"),
    ("10-desktop-staff-add-dialog", "Добавление сотрудника: чипы «Точки» после выходных"),
    ("11-desktop-staff-edit-dialog", "Редактирование сотрудника: те же чипы"),
]
PARTNER = [
    ("12-desktop-partner-cabinet", "Прод: консультант уровня «просмотр» в кабинете клиента — баннер и пилюля точки"),
    ("13-desktop-partner-after-switch", "Прод: консультант переключил точку — список документов точки Б"),
    ("28-desktop-partner-settings-buildings", "Прод: страница точек у консультанта — тумблер выглядит активным"),
    ("29-desktop-partner-toggle-denied", "Прод: клик по тумблеру — тост «Консультанту открыт только просмотр»"),
    ("26-mobile-partner-cabinet", "Прод, телефон: кабинет клиента у консультанта"),
    ("27-mobile-partner-menu", "Прод, телефон: точки в меню-шторке консультанта"),
]
MOBILE = [
    ("14-mobile-journals", "Журнал: в шапке телефона точка не видна"),
    ("15-mobile-menu-sheet", "Меню-шторка: точки первым блоком"),
    ("16-mobile-document-header", "Документ на телефоне (карточки), точка — в крошках хвостом"),
    ("17-mobile-settings-buildings", "Настройки точек: тумблер на первом экране"),
    ("18-mobile-add-point-form", "Форма «Новая точка» внизу списка"),
    ("24-mobile-restricted-no-pill", "Сотрудник одной точки: переключателя нет"),
    ("23-mini-me-switcher", "Mini App, профиль: блок «Точка»"),
]
POPUPS = [
    ("19-mobile-delete-point-confirm", "Подтверждение удаления точки", "mobile-delete-point-confirm"),
    ("20-mobile-staff-add-dialog", "Добавление сотрудника", "mobile-staff-add-dialog"),
    ("21-mobile-staff-edit-dialog", "Редактирование сотрудника", "mobile-staff-edit-dialog"),
    ("22-mobile-profile-nudge-two-locations", "Анкета после регистрации, «Точек» = 2", "mobile-profile-nudge-two-locations"),
]


def fit_row(key, label):
    f = fits.get(key) or {}
    if not f:
        return f"<tr><td>{label}</td><td colspan='4'>нет замера</td></tr>"
    h = f.get("height")
    vh = f.get("vh")
    pct = round(h / vh * 100) if h and vh else None
    primary = f.get("primary") or "—"
    pv = f.get("primaryVisible")
    inner = f.get("innerScroll")
    verdict = "ok" if f.get("fitsViewport") and pv is not False else "warn"
    note = "внутренний скролл" if inner else "без скролла"
    return (f"<tr><td>{label}</td><td class='mono'>{h} / {vh} px</td><td class='mono'>{pct}%</td>"
            f"<td>{primary}</td><td><span class='chip {verdict}'>{'влезает' if verdict == 'ok' else 'проверить'}</span> <span class='muted'>{note}</span></td></tr>")


CHECKS = [
    ("Режим выключен → пилюли точки нет", "ok", "dev"),
    ("Две точки → пилюля, меню с адресами, переключение ставит cookie", "ok", "dev"),
    ("Список документов и страница журнала — только активная точка и общие документы", "ok", "dev"),
    ("Шапка документа и PDF печатают точку с адресом", "ok", "dev"),
    ("Тумблер «Вести журналы отдельно по точкам» включается и выключается", "ok", "dev"),
    ("Чипы «Точки» в диалогах добавления и редактирования сотрудника", "ok", "dev"),
    ("Сотрудник с одной точкой: переключателя нет, список только своей точки, чужая точка → 403", "ok", "dev"),
    ("Меню-шторка на телефоне: точки первым блоком", "ok", "dev"),
    ("Mini App, профиль: блок «Точка», переключение ставит cookie", "ok", "dev"),
    ("Все всплывашки на 390×780 влезают в первый экран, главная кнопка видна без скролла", "ok", "dev"),
    ("Консультант «просмотр»: открыть кабинет клиента, видит баннер и пилюлю", "ok", "prod"),
    ("Консультант «просмотр»: переключить точку → 200", "ok", "prod"),
    ("Консультант «просмотр»: создать точку, включить/выключить режим, создать документ → 403", "ok", "prod"),
    ("Mini App: /api/mini/home отвечает 2–3 с, блок точки появляется с задержкой", "warn", "dev"),
    ("Dev-сервер: guard партнёра не применяется (claim в cookie есть, middleware пропускает) — на проде работает", "warn", "dev"),
]

ROUND1 = [
    ("Телефон не показывает точку", "В мобильной шапке и в крошках точки нет — узнать, где ты, можно только открыв меню. Для сети это главный вопрос экрана."),
    ("Общие документы без пометки", "«Гигиенический журнал · Сентябрь с 1 по 15» показывается на каждой точке без объяснения, что он общий. Рядом с документом точки выглядит как дубль."),
    ("Дашборд без разреза по точкам", "«Обязательные журналы 0/35» и «заполнено 25/35» считаются для активной точки, но нигде не подписано, для какой. Управляющая сетью переключает точки вслепую."),
    ("Консультант видит активный тумблер", "У партнёра уровня «просмотр» тумблер режима и «Добавить точку» выглядят рабочими; отказ приходит тостом после клика (прод, снимок 29)."),
    ("Меню-шторка смешивает уровни", "Список точек и строка организации ниже оформлены одинаково — организация читается как ещё одна точка."),
    ("Три ряда чипов в диалоге сотрудника", "На 390×780 диалог занимает 85–89 % экрана; на 360×640 при четырёх и более точках чипы уйдут за край."),
    ("Тексты со старой моделью", "Подтверждение удаления говорило про «здание» и «зону», подсказка страницы — про корпуса и legacy-цеха, анкета писала «точки (2)». Исправлено в этом прогоне."),
    ("Меню точек — только выбор", "Из выпадающего списка нельзя перейти к настройке точек или добавить новую; приходится искать раздел в настройках."),
]
ROUND2 = [
    ("Нет режима «Все точки»", "Проверить три кафе — три переключения. Нужна сводка по точкам: строка на точку с заполненностью и кликом-переключением."),
    ("Точки рождаются безымянными", "После анкеты появляются «Точка 1…N» без адресов; в шапке документа так и напечатается, пока не переименуют."),
    ("Сотрудники без точки получают всё", "Пустой список точек = задачи со всех точек. После включения режима каждый сотрудник получает N обязательств в день, пока управляющая не расставит чипы."),
    ("Выбор точки живёт в браузере", "Cookie не переезжает на другое устройство: на новом телефоне менеджер молча оказывается на первой точке."),
    ("Новая точка пустая", "У точки нет помещений — журналы уборки и климата по ней пустые, пока не заведут заново; копирования из соседней точки нет."),
    ("Сводные разделы без разреза", "Отчёты, экспорт, инспекторская ссылка и поиск отдают всё по организации без колонки «Точка»."),
    ("Закрытие дня общее", "«Закрыть день без событий» на точке А помечает журнал закрытым и на точке Б — уникальный ключ остался на организацию (осознанное ограничение v1)."),
    ("Выключение режима без предупреждения", "Тумблер выключается мгновенно; что документы точек теперь показываются все вместе, никто не объясняет."),
]
IMPROVEMENTS = [
    ("S", "Телефон", "Показать точку в мобильной шапке: чип с иконкой под логотипом и хвост крошек «› Точка А»."),
    ("S", "Журналы", "Бейдж «Общий» у документов без точки при включённом режиме; в подсказке — почему он виден везде."),
    ("L", "Дашборд", "Сводка по точкам: строка на точку — заполнено/всего, просрочки, клик переключает точку."),
    ("S", "Партнёры", "Для консультанта «просмотр» — тумблер и «Добавить точку» неактивны с подсказкой «Изменяет клиент», без тоста после клика."),
    ("M", "Сотрудники", "Новый сотрудник по умолчанию привязывается к активной точке; на странице сотрудников баннер «12 человек без точки получают задачи всех точек»."),
    ("M", "Регистрация", "После анкеты — шаг «Назовите точки»: название и адрес каждой (адрес через DaData), вместо «Точка 1…N»."),
    ("S", "Аккаунт", "Запоминать выбранную точку в аккаунте (последняя активная точка), а cookie использовать как кэш."),
    ("M", "Точки", "Кнопка «Скопировать помещения из другой точки» при создании точки и в пустом состоянии карточки."),
    ("M", "Отчёты", "Колонка и фильтр «Точка» в отчётах, экспорте организации и инспекторской ссылке."),
    ("S", "Поиск", "Подпись точки в результатах поиска и в списке документов Mini App."),
    ("L", "Техдолг", "Ключи JournalCloseEvent и JournalPreview расширить точкой ручной миграцией на проде — тогда «закрыть день» и превью станут по точкам."),
    ("M", "PDF", "Реквизиты точки: КПП, телефон, ответственный по точке — в шапку PDF под организацией."),
    ("L", "Mini App", "Координаты точки из адреса (DaData) и автоподбор точки по GPS при открытии Mini App — на базе существующего GeoReminder."),
    ("S", "Автосоздание", "На странице автосоздания показывать «документы создаются на 3 точки» и прогноз количества."),
    ("S", "Точки", "Выключение режима — ConfirmDialog с последствиями: документы точек станут видны все вместе, ночное создание станет общим."),
    ("M", "Точки", "Мультивыбор сотрудников в карточке точки («кто работает здесь») — зеркало чипов из карточки сотрудника."),
    ("S", "Сотрудники", "При четырёх и более точках чипы сворачивать в кнопку «Все точки ▾» с выпадающим списком, чтобы диалог влезал на 360×640."),
    ("S", "Телефон", "В меню-шторке отделить точки от разделов: заголовок «Организация» над строкой организации и разделитель."),
    ("M", "Mini App", "Точка в верхней панели Mini App на всех экранах; синхронизацию обязательств вынести из GET /api/mini/home в фон, чтобы экран открывался мгновенно."),
    ("S", "Инфраструктура", "Разобраться, почему guard партнёра не срабатывает на dev-сервере (на проде — 403): иначе тесты партнёрских сценариев на dev недостоверны."),
]

html = io.StringIO()
html.write('''<title>Дым точек Wesetup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#f6f7fb;--panel:#ffffff;--ink:#141830;--muted:#6b7186;--line:#e4e7f1;--soft:#eef1ff;--accent:#5566f6;--accent-ink:#3848c7;--good-bg:#e8f6ee;--good:#1d7a4f;--warn-bg:#fff2e3;--warn:#a85a0c;--bad-bg:#fdebea;--bad:#b3261e;--shadow:0 18px 44px -28px rgba(20,24,48,.35)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111426;--panel:#191d33;--ink:#eef0f8;--muted:#a3a8c0;--line:#2a2f4a;--soft:#232848;--accent:#8b97ff;--accent-ink:#b4bcff;--good-bg:#173626;--good:#7fd5a4;--warn-bg:#3b2a12;--warn:#f1b566;--bad-bg:#3d1c1a;--bad:#f0968f;--shadow:0 18px 44px -28px rgba(0,0,0,.7)}}
:root[data-theme="dark"]{--bg:#111426;--panel:#191d33;--ink:#eef0f8;--muted:#a3a8c0;--line:#2a2f4a;--soft:#232848;--accent:#8b97ff;--accent-ink:#b4bcff;--good-bg:#173626;--good:#7fd5a4;--warn-bg:#3b2a12;--warn:#f1b566;--bad-bg:#3d1c1a;--bad:#f0968f;--shadow:0 18px 44px -28px rgba(0,0,0,.7)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "IBM Plex Sans","Segoe UI",system-ui,sans-serif}
.wrap{max-width:1120px;margin:0 auto;padding:40px 24px 80px}
h1,h2,h3{font-family:Manrope,"Segoe UI",sans-serif;letter-spacing:-.02em;text-wrap:balance;margin:0}
h1{font-size:34px;font-weight:800;line-height:1.1}
h2{font-size:22px;font-weight:700;margin-top:56px;margin-bottom:6px}
h3{font-size:16px;font-weight:700}
.eyebrow{font-family:Manrope,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.lead{max-width:64ch;color:var(--muted);margin:10px 0 0}
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:26px}
.strip div{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:14px 16px}
.strip b{display:block;font-family:Manrope,sans-serif;font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}
.strip span{font-size:13px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px;background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden}
th,td{padding:10px 14px;text-align:left;vertical-align:top;border-top:1px solid var(--line)}
th{font-family:Manrope,sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-top:0;background:var(--soft)}
.tablewrap{overflow-x:auto;margin-top:14px}
.mono{font-family:"IBM Plex Mono",Consolas,monospace;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.muted{color:var(--muted)}
.chip{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;font-family:Manrope,sans-serif;white-space:nowrap}
.chip.ok{background:var(--good-bg);color:var(--good)}.chip.warn{background:var(--warn-bg);color:var(--warn)}.chip.bad{background:var(--bad-bg);color:var(--bad)}
.chip.env{background:var(--soft);color:var(--accent-ink)}
.chip.size{min-width:26px;text-align:center;background:var(--soft);color:var(--accent-ink)}
.gallery{display:grid;gap:18px;margin-top:16px}
.gallery.desktop{grid-template-columns:repeat(2,1fr)}
.gallery.mobile{grid-template-columns:repeat(4,1fr)}
@media (max-width:900px){.gallery.desktop{grid-template-columns:1fr}.gallery.mobile{grid-template-columns:repeat(2,1fr)}.strip{grid-template-columns:repeat(2,1fr)}}
.shot{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.shot .zoom{all:unset;cursor:zoom-in;display:block;background:var(--soft)}
.shot img{display:block;width:100%;height:auto}
.shot.desktop img{aspect-ratio:1280/860;object-fit:cover;object-position:top}
.shot.mobile img{aspect-ratio:390/780;object-fit:cover;object-position:top}
.shot figcaption{font-size:13px;line-height:1.45;padding:10px 12px 12px;color:var(--ink);border-top:1px solid var(--line)}
.shot .num{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--muted);margin-right:8px}
.shot.missing .ph{padding:40px;text-align:center;color:var(--muted)}
.notes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
@media (max-width:900px){.notes{grid-template-columns:1fr}}
.note{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px}
.note h3{margin-bottom:4px}
.note p{margin:0;color:var(--muted);font-size:14px}
ol.improve{list-style:none;padding:0;margin:16px 0 0;counter-reset:n;display:grid;gap:8px}
ol.improve li{counter-increment:n;display:grid;grid-template-columns:32px 34px 120px 1fr;gap:12px;align-items:start;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:11px 14px}
ol.improve li::before{content:counter(n);font-family:"IBM Plex Mono",monospace;color:var(--muted);font-size:13px;padding-top:2px}
ol.improve .area{font-size:13px;color:var(--muted);padding-top:2px}
@media (max-width:700px){ol.improve li{grid-template-columns:28px 30px 1fr}ol.improve .area{grid-column:2/4}}
.legend{font-size:13px;color:var(--muted);margin-top:10px}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1400px);max-height:96vh}
dialog::backdrop{background:rgba(10,12,28,.72)}
dialog img{display:block;max-width:96vw;max-height:94vh;width:auto;height:auto;border-radius:12px;box-shadow:var(--shadow)}
a{color:var(--accent-ink)}
.zoom:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
</style>
<div class="wrap">
<div class="eyebrow">Wesetup · точки внутри организации · 5 сентября 2026</div>
<h1>Дым точек: 29 экранов, партнёр, телефон, всплывашки</h1>
<p class="lead">Прогон по тестовой организации «Кафе «Тестовое 1»» с двумя точками (Точка А на Ленина, 5 и Точка Б): dev-сервер для экранов клиента и продакшен для консультанта. Ниже — что проверено, снимки, два круга критики и двадцать предложений.</p>
''')

ok = sum(1 for _, v, _ in CHECKS if v == "ok")
warn = sum(1 for _, v, _ in CHECKS if v == "warn")
html.write(f'''<div class="strip">
<div><b>29</b><span>снимков экрана</span></div>
<div><b>{ok}</b><span>проверок прошли</span></div>
<div><b>{warn}</b><span>замечания, не блокируют</span></div>
<div><b>20</b><span>предложений улучшить</span></div>
</div>''')

html.write('<h2>Что проверено</h2><p class="lead">Клиентские сценарии — на dev, партнёрские — на проде: там guard записи для консультанта уровня «просмотр» работает, на dev он не применяется.</p><div class="tablewrap"><table><tr><th>Проверка</th><th>Где</th><th>Итог</th></tr>')
for label, verdict, env in CHECKS:
    html.write(f"<tr><td>{label}</td><td><span class='chip env'>{env}</span></td><td><span class='chip {verdict}'>{'прошла' if verdict == 'ok' else 'замечание'}</span></td></tr>")
html.write("</table></div>")

html.write('<h2>Десктоп: одна точка, две точки, диалоги</h2><div class="gallery desktop">')
for name, cap in DESKTOP:
    html.write(figure(name, cap, "desktop"))
html.write("</div>")

html.write('<h2>Консультант в кабинете клиента (прод)</h2><p class="lead">Партнёр уровня «просмотр»: видит баннер и точки, переключает их, но любая запись отбивается с 403.</p><div class="gallery desktop">')
for name, cap in PARTNER[:4]:
    html.write(figure(name, cap, "desktop"))
html.write('</div><div class="gallery mobile" style="margin-top:18px">')
for name, cap in PARTNER[4:]:
    html.write(figure(name, cap, "mobile"))
html.write("</div>")

html.write('<h2>Телефон 390×780</h2><div class="gallery mobile">')
for name, cap in MOBILE:
    html.write(figure(name, cap, "mobile"))
html.write("</div>")

html.write('<h2>Всплывашки: влезают ли в первый экран</h2><p class="lead">Критерий тот же, что у окна после регистрации: окно целиком в экране, главная кнопка видна без прокрутки.</p><div class="gallery mobile">')
for name, cap, _ in POPUPS:
    html.write(figure(name, cap, "mobile"))
html.write('</div><div class="tablewrap"><table><tr><th>Окно</th><th>Высота / экран</th><th>Доля</th><th>Главная кнопка</th><th>Итог</th></tr>')
for name, cap, key in POPUPS:
    html.write(fit_row(key, cap))
html.write(fit_row("mobile-menu-sheet", "Меню-шторка (точки в начале списка)"))
html.write('</table></div><p class="legend">Анкета и подтверждение удаления — это нижние листы на всю высоту экрана, поэтому 100 %: содержимое внутри короче. Диалоги сотрудника занимают 85–89 % экрана — на 360×640 при четырёх и более точках чипы уйдут за край (предложение 17).</p>')

html.write('<h2>Критика, круг первый: что видно на экранах</h2><div class="notes">')
for title, body in ROUND1:
    html.write(f"<div class='note'><h3>{title}</h3><p>{body}</p></div>")
html.write("</div>")
html.write('<h2>Критика, круг второй: сценарии и края</h2><div class="notes">')
for title, body in ROUND2:
    html.write(f"<div class='note'><h3>{title}</h3><p>{body}</p></div>")
html.write("</div>")

html.write('<h2>Двадцать предложений</h2><p class="legend">S — час-два, M — день, L — несколько дней или миграция.</p><ol class="improve">')
for size, area, text in IMPROVEMENTS:
    html.write(f"<li><span class='chip size'>{size}</span><span class='area'>{area}</span><span>{text}</span></li>")
html.write("</ol>")

html.write('''<h2>Уже исправлено по итогам дыма</h2><div class="notes">
<div class="note"><h3>Подтверждение удаления точки</h3><p>Текст говорил о «здании» и «зоне»; теперь: помещения удалятся, документы останутся в организации и станут общими. Кнопка получила подпись «Удалить точку».</p></div>
<div class="note"><h3>Подсказка на странице точек</h3><p>Вместо корпусов и legacy-цехов — что такое точка, минимум для запуска, что сотрудники общие, что будет с документами при включении режима и удалении точки.</p></div>
<div class="note"><h3>Анкета после регистрации</h3><p>«Создадим точки (2)» стало «Создадим 2 точки: журналы по каждой отдельно, сотрудники общие».</p></div>
<div class="note"><h3>Переход в точку из обязательства</h3><p>Редирект строил абсолютный адрес от localhost за nginx — заменён на относительный Location, проверено на проде.</p></div>
</div>
</div>
<dialog id="lb"><img alt=""></dialog>
<script>
const lb=document.getElementById("lb"),lbImg=lb.querySelector("img");
document.querySelectorAll(".zoom").forEach(b=>b.addEventListener("click",()=>{lbImg.src=b.dataset.src;lbImg.alt=b.getAttribute("aria-label")||"";lb.showModal();}));
lb.addEventListener("click",e=>{if(e.target===lb)lb.close();});
</script>
''')

io.open(OUT, "w", encoding="utf-8", newline="\n").write(html.getvalue())
print("written", OUT, round(os.path.getsize(OUT) / 1024 / 1024, 2), "MB")
