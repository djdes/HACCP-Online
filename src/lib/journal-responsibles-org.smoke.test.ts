import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

import { ORG_NAME_FALLBACK } from "@/lib/journal-constants";

/**
 * Смоук-гварды «журналы строго по организации».
 *
 * Проверяют исходники, а не поведение: поломка, которая реально
 * случается, — новый сеятель образцов без демо-гейта, литерал «Тест»
 * в новом клиенте или поиск пользователя по id без организации в новом
 * адаптере. Юнит-тесты правил при этом остаются зелёными.
 */

const ROOT = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(relative);
  }
  return out;
}

test("название по умолчанию — нейтральное «Организация»", () => {
  assert.equal(ORG_NAME_FALLBACK, "Организация");
});

test("в src нет литералов ООО \"Тест\" / ООО \"Организация\"", () => {
  const offenders = walk("src").filter((file) =>
    /ООО\s*[\\]?["«]Тест[\\]?["»]|ООО\s*[\\]?["«]Организация[\\]?["»]/.test(read(file))
  );
  assert.deepEqual(offenders, []);
});

const ORG_SCOPED_FILES = [
  ...walk("src/lib/tasksflow-adapters"),
  "src/lib/journal-auto-create.ts",
  "src/lib/staff-journal-autofill.ts",
  "src/app/api/journal-documents/route.ts",
];

for (const file of ORG_SCOPED_FILES) {
  test(`пользователь ищется внутри организации: ${file}`, () => {
    assert.doesNotMatch(
      read(file),
      /user\.findUnique\(\s*\{\s*where:\s*\{\s*id\b/,
      `${file}: db.user.findUnique({ where: { id } }) без организации`
    );
  });
}

/**
 * Каждый вызов создания документа/записи в странице журнала лежит под
 * условием с `shouldNormalizeDemoSamples` (демо-организация). Вызовы
 * внутри вспомогательных `ensure*SampleDocuments` проверяются через их
 * места вызова.
 */
test("страница журнала сеет образцы только в демо-организации", () => {
  const file = "src/app/(dashboard)/journals/[code]/page.tsx";
  const source = read(file);
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const GATE = /shouldNormalizeDemoSamples/;

  function isGated(node: ts.Node): boolean {
    let parent: ts.Node | undefined = node.parent;
    let child: ts.Node = node;
    while (parent) {
      if (ts.isIfStatement(parent) && parent.thenStatement === child && GATE.test(parent.expression.getText(sf))) {
        return true;
      }
      if (
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        parent.right === child &&
        GATE.test(parent.left.getText(sf))
      ) {
        return true;
      }
      if (ts.isConditionalExpression(parent) && parent.whenTrue === child && GATE.test(parent.condition.getText(sf))) {
        return true;
      }
      child = parent;
      parent = parent.parent;
    }
    return false;
  }

  function enclosingFunctionName(node: ts.Node): string | null {
    let parent: ts.Node | undefined = node.parent;
    while (parent) {
      if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
      parent = parent.parent;
    }
    return null;
  }

  const ungated: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const isCreate = /^db\.journalDocument(Entry)?\.(create|createMany|upsert)$/.test(callee);
      const inPage = enclosingFunctionName(node) === "JournalDocumentsPage";
      const isSeederCall = /^(ensure\w*Sample\w*|normalizeDemoJournalSampleCorpus)$/.test(callee);
      if ((isCreate && inPage) || isSeederCall) {
        if (!isGated(node)) ungated.push(`L${line} ${callee}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  assert.deepEqual(ungated, [], `вызовы без демо-гейта: ${ungated.join(", ")}`);
  assert.match(source, /shouldNormalizeDemoSamples = orgSettings\?\.isDemo === true/);
  assert.doesNotMatch(source, /admin@haccp\.local/);
});
