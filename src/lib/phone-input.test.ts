import assert from "node:assert/strict";
import test from "node:test";

import {
  RU_PHONE_PREFIX,
  formatRuPhoneInput,
  isRuPhonePrefixOnly,
} from "./phone-input";

test("набор по одной цифре раскладывается в +7 999 123-45-67", () => {
  let value = RU_PHONE_PREFIX;
  const expected = ["+7 9", "+7 99", "+7 999", "+7 999 1", "+7 999 12", "+7 999 123", "+7 999 123-4", "+7 999 123-45", "+7 999 123-45-6", "+7 999 123-45-67"];
  const typed = "9991234567";
  for (let i = 0; i < typed.length; i++) {
    value = formatRuPhoneInput(value + typed[i], value);
    assert.equal(value, expected[i]);
  }
  // лишние цифры отбрасываются
  assert.equal(formatRuPhoneInput(value + "8", value), "+7 999 123-45-67");
});

test("вставка в любом формате приводится к одному виду", () => {
  assert.equal(formatRuPhoneInput("8 985 123 45 67"), "+7 985 123-45-67");
  assert.equal(formatRuPhoneInput("+7 (985) 123-45-67"), "+7 985 123-45-67");
  assert.equal(formatRuPhoneInput("79851234567"), "+7 985 123-45-67");
  assert.equal(formatRuPhoneInput("9851234567"), "+7 985 123-45-67");
  assert.equal(formatRuPhoneInput("+7 812 123-45-67"), "+7 812 123-45-67");
});

test("backspace: разделитель стирает цифру перед ним, префикс стирается целиком", () => {
  assert.equal(formatRuPhoneInput("+7 999", "+7 999 "), "+7 99");
  assert.equal(formatRuPhoneInput("+7 999 123", "+7 999 123-"), "+7 999 12");
  assert.equal(formatRuPhoneInput("+7", RU_PHONE_PREFIX), "");
  assert.equal(formatRuPhoneInput("", "+7 9"), "");
  assert.equal(formatRuPhoneInput("+7 ", "+7 9"), RU_PHONE_PREFIX);
});

test("иностранный код страны не форматируется", () => {
  assert.equal(formatRuPhoneInput("+380 44 123"), "+380 44 123");
  assert.equal(formatRuPhoneInput("+1 415", "+1 41"), "+1 415");
});

test("isRuPhonePrefixOnly", () => {
  assert.equal(isRuPhonePrefixOnly(RU_PHONE_PREFIX), true);
  assert.equal(isRuPhonePrefixOnly("+7"), true);
  assert.equal(isRuPhonePrefixOnly(""), false);
  assert.equal(isRuPhonePrefixOnly("+7 9"), false);
});
