"use client";

/**
 * Bluetooth-щуп для замера температуры (Web Bluetooth).
 *
 * Зачем: самый быстрый ввод — не вводить. В общепите это отраслевой
 * стандарт: у Jolt он называется Touchless Temperature Capture — замер
 * попадает в журнал без набора цифр. У нас 240–720 температур в месяц
 * только по холодильникам, и каждая набирается пальцем.
 *
 * Работает с щупами, реализующими стандартный профиль Bluetooth SIG
 * Health Thermometer: сервис `0x1809`, характеристика Temperature
 * Measurement `0x2A1C`. Значение приходит как IEEE-11073 32-битный
 * FLOAT; младший бит флагов говорит, градусы это Цельсия (0) или
 * Фаренгейта (1).
 *
 * Доступность: Web Bluetooth есть в Chrome/Edge на Android, Windows,
 * macOS и Linux. В Safari и внутри Telegram на iOS его нет — поэтому
 * `isBluetoothProbeSupported()` обязателен перед показом кнопки, иначе
 * человек нажмёт и не поймёт, почему ничего не произошло.
 */

const HEALTH_THERMOMETER_SERVICE = 0x1809;
const TEMPERATURE_MEASUREMENT_CHARACTERISTIC = 0x2a1c;

/** Сколько ждём первого замера, прежде чем сдаться. */
const READING_TIMEOUT_MS = 20_000;

export function isBluetoothProbeSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth ===
      "object"
  );
}

/**
 * Разбор Temperature Measurement (GATT 0x2A1C).
 *
 * Байт 0 — флаги, дальше 4 байта IEEE-11073 FLOAT: три младших байта —
 * мантисса (знаковая), старший — десятичная экспонента (знаковая).
 */
export function parseTemperatureMeasurement(view: DataView): number | null {
  if (view.byteLength < 5) return null;

  const flags = view.getUint8(0);
  const fahrenheit = (flags & 0x01) === 1;

  const raw = view.getUint32(1, /* littleEndian */ true);
  let mantissa = raw & 0x00ffffff;
  // Мантисса знаковая: старший бит 24-битного поля — знак.
  if (mantissa & 0x00800000) mantissa -= 0x01000000;
  // `>>>`, а не `>>`: арифметический сдвиг уже вернул бы знаковое
  // значение, и последующая коррекция знака отняла бы 256 второй раз
  // (экспонента -1 превращалась в -257, и замер уезжал в ноль).
  let exponent = raw >>> 24;
  if (exponent & 0x80) exponent -= 0x100;

  // Спец-значения IEEE-11073 (NaN, +/-Infinity, NRes) — замер не удался.
  if (exponent === 0 && (mantissa === 0x007fffff || mantissa === 0x00800000)) {
    return null;
  }

  const value = mantissa * Math.pow(10, exponent);
  if (!Number.isFinite(value)) return null;

  const celsius = fahrenheit ? ((value - 32) * 5) / 9 : value;
  // Округляем до десятых: журналы хранят температуру с шагом 0.1, а щупы
  // отдают «4.019999999».
  return Math.round(celsius * 10) / 10;
}

export type ProbeReadResult =
  | { ok: true; celsius: number; deviceName: string | null }
  | { ok: false; reason: "unsupported" | "cancelled" | "timeout" | "failed" };

/**
 * Просит пользователя выбрать щуп и возвращает первый замер.
 *
 * Выбор устройства обязан идти из обработчика жеста — браузер требует
 * user activation, иначе `requestDevice` бросает NotAllowedError.
 */
export async function readTemperatureFromProbe(): Promise<ProbeReadResult> {
  if (!isBluetoothProbeSupported()) return { ok: false, reason: "unsupported" };

  const bluetooth = (
    navigator as Navigator & {
      bluetooth: {
        requestDevice(options: unknown): Promise<BluetoothProbeDevice>;
      };
    }
  ).bluetooth;

  let device: BluetoothProbeDevice;
  try {
    device = await bluetooth.requestDevice({
      filters: [{ services: [HEALTH_THERMOMETER_SERVICE] }],
    });
  } catch {
    // Пользователь закрыл системный выбор устройства — это не ошибка.
    return { ok: false, reason: "cancelled" };
  }

  try {
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(
      HEALTH_THERMOMETER_SERVICE
    );
    const characteristic = await service.getCharacteristic(
      TEMPERATURE_MEASUREMENT_CHARACTERISTIC
    );

    const celsius = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), READING_TIMEOUT_MS);

      const onValue = (event: Event) => {
        const target = event.target as { value?: DataView };
        const parsed = target.value
          ? parseTemperatureMeasurement(target.value)
          : null;
        if (parsed === null) return;
        clearTimeout(timer);
        characteristic.removeEventListener(
          "characteristicvaluechanged",
          onValue
        );
        resolve(parsed);
      };

      characteristic.addEventListener("characteristicvaluechanged", onValue);
      void characteristic.startNotifications();
    });

    device.gatt.disconnect();

    if (celsius === null) return { ok: false, reason: "timeout" };
    return { ok: true, celsius, deviceName: device.name ?? null };
  } catch {
    try {
      device.gatt.disconnect();
    } catch {
      /* уже отключён */
    }
    return { ok: false, reason: "failed" };
  }
}

/**
 * Минимальный тип устройства — в TS-библиотеке проекта Web Bluetooth
 * отсутствует, а тащить `@types/web-bluetooth` ради трёх методов не
 * хочется.
 */
type BluetoothProbeDevice = {
  name: string | null;
  gatt: {
    connect(): Promise<{
      getPrimaryService(service: number): Promise<{
        getCharacteristic(characteristic: number): Promise<{
          startNotifications(): Promise<unknown>;
          addEventListener(type: string, listener: (event: Event) => void): void;
          removeEventListener(
            type: string,
            listener: (event: Event) => void
          ): void;
        }>;
      }>;
    }>;
    disconnect(): void;
  };
};
