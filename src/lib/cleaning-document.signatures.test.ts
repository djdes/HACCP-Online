import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCleaningSignatureResolver,
  CLEANING_SIGNATURE_ROW_ID,
  CONTROL_SIGNATURE_ROW_ID,
  listCleaningCodeEntries,
  listControlCodeEntries,
  normalizeCleaningDocumentConfig,
  type CleaningDocumentConfig,
} from "./cleaning-document";

const USERS = [
  { id: "u1", name: "Иванова", role: "cook" },
  { id: "u2", name: "Петрова", role: "cook" },
  { id: "u3", name: "Сидорова", role: "cook" },
];

function roomsDoc(
  patch: Record<string, unknown>,
  users = USERS,
): CleaningDocumentConfig {
  return normalizeCleaningDocumentConfig(
    { cleaningMode: "rooms", selectedRoomIds: ["r1"], rooms: [], ...patch },
    { users },
  );
}

function legend(config: CleaningDocumentConfig) {
  return listCleaningCodeEntries(
    config,
    new Map(USERS.map((u) => [u.id, u.name])),
  ).map((e) => [e.code, e.userName, e.retired === true] as const);
}

test("подпись переживает смену состава: С1 остаётся за прежним человеком", () => {
  const before = roomsDoc({
    selectedCleanerUserIds: ["u1", "u2"],
    matrix: {
      [CLEANING_SIGNATURE_ROW_ID]: { "2026-09-01": "С1", "2026-09-02": "С2" },
    },
  });
  assert.deepEqual(before.cleanerCodeByUserId, { u1: 1, u2: 2 });

  // Увольняем первого уборщика — конфиг пересохраняется без него.
  const after = normalizeCleaningDocumentConfig(
    { ...before, selectedCleanerUserIds: ["u2"] },
    { users: USERS.filter((u) => u.id !== "u1") },
  );
  assert.equal(after.cleanerCodeByUserId?.u2, 2, "номер оставшегося не сдвинулся");

  const resolver = buildCleaningSignatureResolver(legendEntries(after));
  assert.equal(resolver.readManual("С1"), "С1");
  assert.equal(resolver.userIdOf("С1"), "u1");
  assert.equal(resolver.readManual("С2"), "С2");
  assert.equal(resolver.userIdOf("С2"), "u2");

  // Легенда: выбывшая осталась (на неё есть подписи), имя — из снимка.
  assert.deepEqual(legend(after), [
    ["С1", "Иванова", true],
    ["С2", "Петрова", false],
  ]);
});

function legendEntries(config: CleaningDocumentConfig) {
  return listCleaningCodeEntries(
    config,
    new Map(USERS.map((u) => [u.id, u.name])),
  );
}

test("новый уборщик получает следующий свободный номер, а не освободившийся", () => {
  const base = roomsDoc({ selectedCleanerUserIds: ["u1", "u2"] });
  const afterSwap = normalizeCleaningDocumentConfig(
    { ...base, selectedCleanerUserIds: ["u2", "u3"] },
    { users: USERS },
  );
  assert.equal(afterSwap.cleanerCodeByUserId?.u2, 2);
  assert.equal(afterSwap.cleanerCodeByUserId?.u3, 3, "u3 не занимает номер u1");
  assert.deepEqual(legend(afterSwap), [
    ["С2", "Петрова", false],
    ["С3", "Сидорова", false],
  ]);
});

test("старый документ без карты кодов читается по текущему порядку — как раньше", () => {
  const legacy = roomsDoc({ selectedCleanerUserIds: ["u2", "u1"] });
  // Первая нормализация закрепляет ровно то, что документ показывал.
  assert.deepEqual(legacy.cleanerCodeByUserId, { u2: 1, u1: 2 });
  assert.deepEqual(legend(legacy), [
    ["С1", "Петрова", false],
    ["С2", "Иванова", false],
  ]);
});

test("новая подпись пишется ссылкой uid: и читается кодом", () => {
  const config = roomsDoc({ selectedCleanerUserIds: ["u1", "u2"] });
  const resolver = buildCleaningSignatureResolver(legendEntries(config));
  const stored = resolver.encode(["u2"]);
  assert.equal(stored, "uid:u2");
  assert.equal(resolver.readManual(stored), "С2");
  assert.equal(resolver.readManual(`auto:${stored}`), "С2");
  // Явная очистка и протухшая ссылка различимы: "" против null.
  assert.equal(resolver.readManual("—"), "");
  assert.equal(resolver.readManual("uid:ghost"), null);
  assert.equal(resolver.readManual(undefined), null);
});

test("легенда для PDF содержит выбывшего уборщика, пока на нём есть подписи", () => {
  const withSignature = roomsDoc({
    selectedCleanerUserIds: ["u1", "u2"],
    matrix: { [CLEANING_SIGNATURE_ROW_ID]: { "2026-09-01": "uid:u1" } },
  });
  const retired = normalizeCleaningDocumentConfig(
    { ...withSignature, selectedCleanerUserIds: ["u2"] },
    { users: [] },
  );
  const pdfLegend = listCleaningCodeEntries(retired).map(
    (e) => `${e.code} - ${e.userName}`,
  );
  assert.deepEqual(pdfLegend, ["С1 - Иванова", "С2 - Петрова"]);

  // Без подписей выбывший в легенде не держится.
  const noSignature = normalizeCleaningDocumentConfig(
    { ...withSignature, selectedCleanerUserIds: ["u2"], matrix: {} },
    { users: [] },
  );
  assert.deepEqual(
    listCleaningCodeEntries(noSignature).map((e) => e.userId),
    ["u2"],
  );
});

test("выбывший контролёр держится в легенде, пока на нём есть подписи", () => {
  const control = (ids: string[]) =>
    ids.map((userId) => ({ userId, title: "Контролёр" }));
  const before = roomsDoc({
    controlResponsibles: control(["u1", "u2"]),
    matrix: { [CONTROL_SIGNATURE_ROW_ID]: { "2026-09-01": "uid:u1" } },
  });
  assert.deepEqual(before.controlCodeByUserId, { u1: 1, u2: 2 });

  // Управляющая убрала первого контролёра из состава.
  const after = normalizeCleaningDocumentConfig(
    { ...before, controlResponsibles: control(["u2"]) },
    { users: [] },
  );
  assert.deepEqual(
    listControlCodeEntries(after).map(
      (e) => [e.code, e.userName, e.retired === true] as const,
    ),
    [
      ["С1", "Иванова", true],
      ["С2", "Петрова", false],
    ],
  );
  // Подпись по-прежнему читается как «С1» — она осталась его подписью.
  const resolver = buildCleaningSignatureResolver(listControlCodeEntries(after));
  assert.equal(resolver.readManual("uid:u1"), "С1");

  // Без подписей выбывший в легенде не держится.
  const noSignature = normalizeCleaningDocumentConfig(
    { ...before, controlResponsibles: control(["u2"]), matrix: {} },
    { users: [] },
  );
  assert.deepEqual(
    listControlCodeEntries(noSignature).map((e) => e.userId),
    ["u2"],
  );
});
