import assert from "node:assert/strict";
import test from "node:test";

import { createUndoStack, DEFAULT_UNDO_DEPTH } from "./journal-undo";

/**
 * Тесты на ядро истории отмены. Оно нарочно не знает про React и DOM,
 * поэтому проверяется обычным `node --test` без jsdom:
 *   node --import tsx --test --test-reporter=spec "src/lib/journal-undo.test.ts"
 */

/** Шаг, который просто записывает, что его проиграли. */
function trackingStep(id: string, log: string[]) {
  return {
    undo: async () => {
      log.push(`undo:${id}`);
    },
    redo: async () => {
      log.push(`redo:${id}`);
    },
  };
}

test("глубина по умолчанию — 20 шагов", () => {
  assert.equal(DEFAULT_UNDO_DEPTH, 20);
});

test("хранит не больше depth шагов и вытесняет самые старые", async () => {
  const log: string[] = [];
  const stack = createUndoStack();

  for (let index = 1; index <= 25; index += 1) {
    stack.push(trackingStep(String(index), log));
  }

  assert.equal(stack.sizes().undo, 20);

  // Первым отменяется последний шаг, последним — 6-й: шаги 1–5 вытеснены.
  const played: string[] = [];
  for (let index = 0; index < 20; index += 1) {
    const result = await stack.run("undo");
    assert.equal(result.status, "done");
    played.push(log[log.length - 1]);
  }

  assert.equal(played[0], "undo:25");
  assert.equal(played[played.length - 1], "undo:6");
  assert.equal(stack.sizes().undo, 0);
  assert.equal(stack.sizes().redo, 20);

  // Шаги 1–5 не проигрывались вовсе — их выбросило вытеснение.
  assert.ok(!log.includes("undo:5"));
  assert.equal((await stack.run("undo")).status, "empty");
});

test("глубину можно задать явно", async () => {
  const log: string[] = [];
  const stack = createUndoStack({ depth: 3 });
  ["a", "b", "c", "d"].forEach((id) => stack.push(trackingStep(id, log)));

  assert.equal(stack.sizes().undo, 3);
  await stack.run("undo");
  await stack.run("undo");
  await stack.run("undo");
  assert.deepEqual(log, ["undo:d", "undo:c", "undo:b"]);
});

test("отменённый шаг переезжает в redo и повторяется", async () => {
  const log: string[] = [];
  const stack = createUndoStack();
  stack.push(trackingStep("a", log));

  assert.equal((await stack.run("undo")).status, "done");
  assert.deepEqual(stack.sizes(), { undo: 0, redo: 1 });

  assert.equal((await stack.run("redo")).status, "done");
  assert.deepEqual(stack.sizes(), { undo: 1, redo: 0 });
  assert.deepEqual(log, ["undo:a", "redo:a"]);
});

test("новая правка обрывает ветку redo", async () => {
  const log: string[] = [];
  const stack = createUndoStack();
  stack.push(trackingStep("a", log));
  stack.push(trackingStep("b", log));

  await stack.run("undo");
  assert.deepEqual(stack.sizes(), { undo: 1, redo: 1 });

  stack.push(trackingStep("c", log));
  assert.deepEqual(stack.sizes(), { undo: 2, redo: 0 });
  assert.equal((await stack.run("redo")).status, "empty");
});

test("упавший шаг выбрасывается из истории, а не залипает в ней", async () => {
  const stack = createUndoStack();
  const failure = new Error("Прошлые дни закрыты для редактирования");
  stack.push({
    undo: async () => {
      throw failure;
    },
    redo: async () => {},
  });
  stack.push({ undo: async () => {}, redo: async () => {} });

  // Верхний (успешный) шаг отменяется как обычно.
  assert.equal((await stack.run("undo")).status, "done");

  const result = await stack.run("undo");
  assert.equal(result.status, "failed");
  assert.equal(result.status === "failed" ? result.error : null, failure);
  // Шаг не вернулся ни в undo, ни в redo — Ctrl+Z не упрётся в него снова.
  assert.deepEqual(stack.sizes(), { undo: 0, redo: 1 });
});

test("во время проигрыша шага повторный вызов игнорируется", async () => {
  const stack = createUndoStack();
  const holder: { release: (() => void) | null } = { release: null };
  stack.push({ undo: async () => {}, redo: async () => {} });
  // Верхний шаг «висит», пока тест его не отпустит.
  stack.push({
    undo: () =>
      new Promise<void>((resolve) => {
        holder.release = resolve;
      }),
    redo: async () => {},
  });

  const pending = stack.run("undo");
  assert.equal((await stack.run("undo")).status, "busy");
  holder.release?.();
  assert.equal((await pending).status, "done");
  // Нижний шаг остался на месте: параллельный Ctrl+Z его не съел.
  assert.equal(stack.sizes().undo, 1);
});

test("reset очищает обе ветки", async () => {
  const log: string[] = [];
  const stack = createUndoStack();
  stack.push(trackingStep("a", log));
  await stack.run("undo");
  stack.push(trackingStep("b", log));

  stack.reset();
  assert.deepEqual(stack.sizes(), { undo: 0, redo: 0 });
});
