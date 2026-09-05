# -*- coding: utf-8 -*-
import io

p = ".agent/tasks/locations-2026-09/build_report.py"
s = io.open(p, encoding="utf-8").read()

marker = "html.write('''<h2>Уже исправлено по итогам дыма</h2><div class=\"notes\">"
assert s.count(marker) == 1, s.count(marker)
block = '''ROUND2_SHOTS = [
    ("r2-12-prod-mobile-pill", "Прод, телефон: точка в шапке (второй круг; финальная раскладка — отдельной строкой под шапкой)"),
    ("r2-03-mobile-pill-menu", "Телефон: меню точек со ссылкой «Настроить точки»"),
    ("r2-09-mobile-add-default-point", "Добавление сотрудника: активная точка выбрана по умолчанию, диалог 627 из 780 px"),
    ("r2-11-mini-topbar", "Mini App: точка в верхней панели на всех экранах"),
]
ROUND2_DESKTOP = [
    ("r2-05-rename-and-copy", "Точки: карандаш у названия и адреса, копирование помещений из другой точки"),
    ("r2-07-toggle-off-confirm", "Выключение раздельных журналов спрашивает подтверждение"),
    ("r2-08-staff-banner", "Сотрудники: баннер «N сотрудников без точки»"),
    ("r2-10-auto-journals-note", "Автосоздание: заметка «Точек: N»"),
]
DONE2 = [
    ("1, 18", "Точка на телефоне — отдельной строкой под шапкой; в меню точек ссылка «Настроить точки»; в шторке точки отделены заголовком «Разделы»."),
    ("7", "Выбранная точка запоминается в аккаунте: cookie — кэш устройства, на новом телефоне открывается та же точка."),
    ("4", "Консультант «просмотр» видит точки без карандаша, корзины и кнопки «Добавить точку»; тумблер неактивен."),
    ("5", "Новый сотрудник по умолчанию привязан к активной точке; на странице сотрудников баннер «N сотрудников без точки»."),
    ("6, 8", "Название и адрес точки правятся карандашом прямо в карточке (плюс подсказка про «Точка N»); помещения копируются из другой точки одной кнопкой."),
    ("14, 15", "Заметка «Точек: N» на странице автосоздания; выключение режима — через подтверждение с последствиями."),
    ("10, 2", "Поиск показывает точку документа; в меню документов крошек общие документы подписаны «Общий»."),
    ("17, 19", "Чипы точек сворачиваются при пяти и более точках, подсказка ужата до строки — диалог сотрудника 627 px вместо 664; точка в верхней панели Mini App."),
]
html.write('<h2>Второй круг: что уже сделано</h2><p class="lead">Двенадцать пунктов из двадцати закрыты в тот же день, проверены на dev (16 сценариев) и на проде.</p><div class="gallery mobile">')
for name, cap in ROUND2_SHOTS:
    html.write(figure(name, cap, "mobile"))
html.write('</div><div class="gallery desktop" style="margin-top:18px">')
for name, cap in ROUND2_DESKTOP:
    html.write(figure(name, cap, "desktop"))
html.write('</div><ol class="improve" style="margin-top:18px">')
for num, text in DONE2:
    html.write(f"<li><span class='chip ok'>готово</span><span class='area'>№ {num}</span><span>{text}</span></li>")
html.write("</ol>")

'''
s = s.replace(marker, block + marker)

old2 = '''for size, area, text in IMPROVEMENTS:
    html.write(f"<li><span class='chip size'>{size}</span><span class='area'>{area}</span><span>{text}</span></li>")'''
assert s.count(old2) == 1
new2 = '''DONE_INDEXES = {1, 2, 4, 5, 6, 7, 8, 10, 14, 15, 17, 18, 19}
for idx, (size, area, text) in enumerate(IMPROVEMENTS, start=1):
    status = "<span class='chip ok'>сделано</span> " if idx in DONE_INDEXES else ""
    html.write(f"<li><span class='chip size'>{size}</span><span class='area'>{area}</span><span>{status}{text}</span></li>")'''
s = s.replace(old2, new2)

old3 = "S — час-два, M — день, L — несколько дней или миграция.</p><ol class=\"improve\">"
assert s.count(old3) == 1
s = s.replace(old3, "S — час-два, M — день, L — несколько дней или миграция. Отмеченные «сделано» закрыты во втором круге.</p><ol class=\"improve\">")

old4 = "<h1>Дым точек: 29 экранов, партнёр, телефон, всплывашки</h1>"
assert s.count(old4) == 1
s = s.replace(old4, "<h1>Дым точек: 37 экранов, партнёр, телефон, всплывашки</h1>")
old5 = "<div><b>29</b><span>снимков экрана</span></div>"
assert s.count(old5) == 1
s = s.replace(old5, "<div><b>37</b><span>снимков экрана</span></div>")
old6 = "<div><b>20</b><span>предложений улучшить</span></div>"
assert s.count(old6) == 1
s = s.replace(old6, "<div><b>13 / 20</b><span>предложений уже сделано</span></div>")

io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("report script updated")
