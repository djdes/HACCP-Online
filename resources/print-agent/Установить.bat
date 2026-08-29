@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Онлайн принтер Wesetup

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║   Онлайн принтер Wesetup — установка      ║
echo   ╚══════════════════════════════════════════╝
echo.
echo   Программа позволит печатать журналы с телефона
echo   на принтер, подключённый к этому компьютеру.
echo.

cd /d "%~dp0"

:: ── Node.js ────────────────────────────────────────────────────────
:: Сами скачиваем портативную сборку, если системного Node нет: просить
:: человека, который просто хочет печатать, сначала поставить среду
:: разработки — нечестно.
set "NODE_EXE=node"
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%~dp0runtime\node.exe" (
        set "NODE_EXE=%~dp0runtime\node.exe"
    ) else (
        echo   Node.js не найден — скачиваю ^(около 30 МБ, один раз^)...
        echo.
        powershell -NoProfile -Command ^
          "$ErrorActionPreference='Stop';" ^
          "$url='https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip';" ^
          "$zip=Join-Path $env:TEMP 'wesetup-node.zip';" ^
          "Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing;" ^
          "Expand-Archive -Path $zip -DestinationPath $env:TEMP\wesetup-node -Force;" ^
          "$src=(Get-ChildItem $env:TEMP\wesetup-node -Directory | Select-Object -First 1).FullName;" ^
          "New-Item -ItemType Directory -Force -Path '%~dp0runtime' | Out-Null;" ^
          "Copy-Item (Join-Path $src 'node.exe') '%~dp0runtime\node.exe' -Force;" ^
          "Remove-Item $zip -Force"
        if !errorlevel! neq 0 (
            echo.
            echo   Не удалось скачать Node.js. Проверьте интернет или поставьте
            echo   его вручную с https://nodejs.org/ и запустите файл снова.
            echo.
            pause
            exit /b 1
        )
        set "NODE_EXE=%~dp0runtime\node.exe"
        echo   Готово.
        echo.
    )
)

:: ── Подключение ────────────────────────────────────────────────────
if not exist "%~dp0config.json" (
    "!NODE_EXE!" setup.js
    if !errorlevel! neq 0 (
        echo.
        echo   Установка прервана.
        pause
        exit /b 1
    )
)

:: ── Автозапуск ─────────────────────────────────────────────────────
:: Ярлык в автозагрузке пользователя, а НЕ служба: служба работает под
:: SYSTEM и не видит принтеры, установленные пользователем, — а в
:: заведении стоят именно такие.
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%~dp0run-hidden.vbs"

> "%VBS%" echo Set s = CreateObject("WScript.Shell")
>> "%VBS%" echo s.CurrentDirectory = "%~dp0"
>> "%VBS%" echo s.Run """!NODE_EXE!"" agent.js", 0, False

powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP%\WesetupPrintAgent.lnk');" ^
  "$s.TargetPath='%VBS%'; $s.WorkingDirectory='%~dp0'; $s.Save()" >nul

start "" wscript "%VBS%"

echo.
echo   ✓ Готово. Программа запущена и будет включаться сама.
echo.

:: Автовход в Windows — единственное, что программа не может сделать за
:: человека: это выбор про безопасность машины, и делать его молча нельзя.
powershell -NoProfile -Command ^
  "$k='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon';" ^
  "$v=(Get-ItemProperty -Path $k -Name AutoAdminLogon -ErrorAction SilentlyContinue).AutoAdminLogon;" ^
  "if ($v -ne '1') { Write-Host '   ВАЖНО: включите автовход в Windows.' -ForegroundColor Yellow;" ^
  "Write-Host '   Иначе после перезагрузки никто не войдёт в систему и печатать будет некому.';" ^
  "Write-Host '   Как: Win+R -> netplwiz -> снять галочку «Требовать ввод имени и пароля».' }"

echo.
echo   Проверьте: откройте wesetup.ru на телефоне, любой журнал,
echo   меню «...» — «На принтер заведения».
echo.
pause
