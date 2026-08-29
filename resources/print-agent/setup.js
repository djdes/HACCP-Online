'use strict';

/**
 * Первый запуск: вход в Wesetup и получение ключа доступа.
 *
 * Пароль спрашиваем ровно один раз, держим только в памяти и отправляем
 * одним HTTPS-запросом. На диск ложится ТОЛЬКО выданный сервером токен —
 * поэтому после перезагрузки агент поднимается сам и ничего не
 * спрашивает.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DEFAULT_API = 'https://wesetup.ru';

function ask(question, { silent = false } = {}) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        if (!silent) {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.trim());
            });
            return;
        }
        // Пароль не должен светиться на экране: гасим эхо вручную —
        // readline своего режима для этого не даёт.
        process.stdout.write(question);
        const onData = (char) => {
            const s = String(char);
            if (s === '\n' || s === '\r' || s === '') {
                process.stdin.removeListener('data', onData);
                return;
            }
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(rl.line.length));
        };
        process.stdin.on('data', onData);
        rl.question('', (answer) => {
            rl.close();
            process.stdout.write('\n');
            resolve(answer.trim());
        });
    });
}

/** Список принтеров Windows — чтобы человек выбрал из готового, а не вписывал имя руками. */
function listPrinters() {
    try {
        const out = execSync(
            'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
            { encoding: 'utf8', timeout: 15000 },
        );
        return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    } catch {
        return [];
    }
}

async function main() {
    console.log('');
    console.log('  Онлайн принтер Wesetup — подключение');
    console.log('  ─────────────────────────────────────────');
    console.log('');

    const existing = fs.existsSync(CONFIG_PATH)
        ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
        : {};

    const apiUrl = (await ask(`  Адрес Wesetup [${existing.apiUrl || DEFAULT_API}]: `))
        || existing.apiUrl || DEFAULT_API;
    const email = await ask('  Ваша почта в Wesetup: ');
    const password = await ask('  Пароль: ', { silent: true });
    const deviceName = (await ask(`  Название этой машины [${os.hostname()}]: `)) || os.hostname();

    console.log('');
    console.log('  Проверяю…');

    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/print/agents/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceName, agentVersion: '1.0.0' }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
        console.log('');
        console.log(`  ✗ ${data?.error || `Ошибка ${res.status}`}`);
        console.log('');
        process.exit(1);
    }

    // Принтер выбираем после успешного входа: незачем спрашивать, если
    // подключиться всё равно не вышло.
    const printers = listPrinters();
    let printerName = '';
    if (printers.length > 0) {
        console.log('');
        console.log('  Принтеры на этой машине:');
        printers.forEach((p, i) => console.log(`    ${i + 1}. ${p}`));
        const choice = await ask('  Номер принтера (Enter — по умолчанию): ');
        const idx = Number(choice) - 1;
        if (printers[idx]) printerName = printers[idx];
    } else {
        printerName = await ask('  Имя принтера (Enter — по умолчанию): ');
    }

    const config = {
        apiUrl,
        agentToken: data.agentToken,
        printerName,
        pollIntervalMs: existing.pollIntervalMs || 5000,
        sumatraPath: existing.sumatraPath || 'SumatraPDF.exe',
        maxLogSizeMb: existing.maxLogSizeMb || 10,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), { mode: 0o600 });

    console.log('');
    console.log(`  ✓ Подключено: ${data.organizationName} (${data.userName})`);
    console.log(`    Принтер: ${printerName || 'по умолчанию'}`);
    console.log(`    Ключ доступа сохранён в config.json — пароль на диск не записан.`);
    console.log('');
    console.log('  Дальше: install.bat — поставит программу в автозапуск.');
    console.log('');
}

main().catch((err) => {
    console.log('');
    console.log(`  ✗ ${err.message}`);
    console.log('');
    process.exit(1);
});
