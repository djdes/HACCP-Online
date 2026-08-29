@echo off
chcp 65001 >nul
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP%\WesetupPrintAgent.lnk" del "%STARTUP%\WesetupPrintAgent.lnk"
taskkill /f /im node.exe /fi "WINDOWTITLE eq WesetupPrintAgent*" >nul 2>&1
echo   Автозапуск снят. Ключ доступа в config.json остался — удалите файл,
echo   если машина больше не будет печатать, и отключите её в Wesetup.
pause
