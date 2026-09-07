import assert from "node:assert/strict";
import test from "node:test";

import { parseTemperatureMeasurement } from "./bluetooth-probe";

/**
 * Собирает пакет Temperature Measurement (GATT 0x2A1C) так же, как его
 * шлёт щуп: байт флагов + IEEE-11073 32-битный FLOAT (3 байта знаковой
 * мантиссы + 1 байт знаковой десятичной экспоненты), little-endian.
 */
function packMeasurement(mantissa: number, exponent: number, flags = 0) {
  const buffer = new ArrayBuffer(5);
  const view = new DataView(buffer);
  view.setUint8(0, flags);
  const m = mantissa < 0 ? mantissa + 0x01000000 : mantissa;
  const e = exponent < 0 ? exponent + 0x100 : exponent;
  view.setUint32(1, (e << 24) | (m & 0x00ffffff), true);
  return view;
}

test("читает положительную температуру в Цельсиях", () => {
  // 41 × 10^-1 = 4.1 °C — типичный холодильник.
  assert.equal(parseTemperatureMeasurement(packMeasurement(41, -1)), 4.1);
});

test("читает отрицательную температуру морозильника", () => {
  // -185 × 10^-1 = -18.5 °C
  assert.equal(parseTemperatureMeasurement(packMeasurement(-185, -1)), -18.5);
});

test("переводит Фаренгейты в Цельсии", () => {
  // Флаг единиц = 1 → 39.2 °F = 4 °C.
  assert.equal(parseTemperatureMeasurement(packMeasurement(392, -1, 0x01)), 4);
});

test("округляет до десятых", () => {
  // 40199 × 10^-4 = 4.0199 → 4.0
  assert.equal(parseTemperatureMeasurement(packMeasurement(40199, -4)), 4);
});

test("возвращает null на спец-значении NaN", () => {
  assert.equal(parseTemperatureMeasurement(packMeasurement(0x007fffff, 0)), null);
});

test("возвращает null на слишком коротком пакете", () => {
  const view = new DataView(new ArrayBuffer(3));
  assert.equal(parseTemperatureMeasurement(view), null);
});
