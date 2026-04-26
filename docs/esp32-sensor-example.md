# DIY-датчики для WeSetup (ESP32 / Arduino / Raspberry Pi)

## Зачем

Один Tuya-датчик стоит ≈2000 ₽. ESP32 + DS18B20 (водонепроницаемый зонд) обходится в **≈400 ₽** и ставится за 10 минут. Для холодильников / морозилок — отличная замена.

## Endpoint

```
POST https://wesetup.ru/api/external/sensors
Authorization: Bearer <ваш_org_token_из_/settings/api>
Content-Type: application/json
```

### Body

```json
{
  "equipmentId": "cuid_abc...",
  "type": "temperature",
  "value": 4.2,
  "timestamp": "2026-04-27T12:34:56Z"
}
```

- `equipmentId` — обязательно, ID единицы оборудования из админки (`/settings/equipment`).
- `type` — `"temperature"` (°C) или `"humidity"` (%).
- `value` — float.
- `timestamp` — необязательно, ISO-8601. По умолчанию = время приёма на сервере.

### Response (200)

```json
{
  "ok": true,
  "equipmentId": "cuid_abc...",
  "entriesWritten": 1,
  "documentId": "cuid_doc...",
  "capaCreated": false,
  "capaTicketId": null
}
```

При втором подряд замере вне диапазона `Equipment.tempMin..tempMax` система автоматически откроет CAPA-тикет (`capaCreated: true`) и пингнёт менеджеру в Telegram.

## ESP32 + DS18B20 — пример прошивки

Зависимости (Arduino IDE → Library Manager):

- `WiFi` (встроена)
- `HTTPClient` (встроена)
- `OneWire` by Paul Stoffregen
- `DallasTemperature` by Miles Burton

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// === Конфиг ===
const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "YourPassword";

const char* WESETUP_TOKEN = "ваш_org_token";  // /settings/api
const char* EQUIPMENT_ID = "cuid_abc...";     // /settings/equipment

const int  ONEWIRE_PIN = 4;        // GPIO для DS18B20
const long INTERVAL_MS = 30 * 60 * 1000;  // 30 минут между замерами

// === Setup ===
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  delay(500);
  sensors.begin();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  sensors.requestTemperatures();
  float t = sensors.getTempCByIndex(0);
  Serial.printf("t = %.2f °C\n", t);

  if (t > -100 && t < 100 && WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("https://wesetup.ru/api/external/sensors");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + WESETUP_TOKEN);

    String body = String("{\"equipmentId\":\"") + EQUIPMENT_ID +
                  "\",\"type\":\"temperature\",\"value\":" + String(t, 2) + "}";
    int code = http.POST(body);
    Serial.printf("HTTP %d\n", code);
    http.end();
  }

  delay(INTERVAL_MS);
}
```

### Как залить

1. Купить **ESP32 DevKit** (≈300 ₽ на Озоне) + **DS18B20 водонепроницаемый зонд** (≈100 ₽).
2. Подключить:
   - VCC → 3.3V
   - GND → GND
   - Data → GPIO4 (через подтяжку 4.7 кОм к 3.3V)
3. В Arduino IDE: Tools → Board → ESP32 Dev Module.
4. Скопировать sketch выше, заменить `WIFI_*`, `WESETUP_TOKEN`, `EQUIPMENT_ID`.
5. Upload → Serial Monitor покажет `t = 4.21 °C` → `HTTP 200`.
6. В админке `/journals/cold_equipment_control` через 30 мин появится колонка с этим значением.

## Raspberry Pi + Python

```python
#!/usr/bin/env python3
import requests, time, glob

TOKEN = "ваш_org_token"
EQUIPMENT_ID = "cuid_abc..."
URL = "https://wesetup.ru/api/external/sensors"
INTERVAL = 30 * 60  # 30 минут

# DS18B20 на Raspberry Pi (через 1-Wire kernel module)
def read_temp():
    base = "/sys/bus/w1/devices/28-*/w1_slave"
    files = glob.glob(base)
    if not files: return None
    with open(files[0]) as f:
        lines = f.read().split("\n")
    if "YES" not in lines[0]: return None
    t = lines[1].split("t=")[1]
    return float(t) / 1000.0

while True:
    t = read_temp()
    if t is not None:
        r = requests.post(URL, json={
            "equipmentId": EQUIPMENT_ID,
            "type": "temperature",
            "value": round(t, 2),
        }, headers={"Authorization": f"Bearer {TOKEN}"})
        print(f"{t:.2f} °C → HTTP {r.status_code}: {r.text}")
    time.sleep(INTERVAL)
```

## Curl-тест

```bash
curl -X POST https://wesetup.ru/api/external/sensors \
  -H "Authorization: Bearer $WESETUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"cuid_abc...","type":"temperature","value":4.2}'
```

## Где взять Equipment ID

`/settings/equipment` → кликнуть на нужный холодильник → URL содержит ID. Или через Prisma Studio.

## Где взять токен

`/settings/api` → кнопка «Сгенерировать ключ» (нужны права owner/manager).

## Лимиты

- Тариф «trial» — 100 запросов в день.
- Тариф «paid» — 10 000 запросов в день.

Для холодильников рекомендуем интервал ≥ 5 минут. Чаще не имеет смысла — журнал температуры всё равно агрегирует по слотам.
