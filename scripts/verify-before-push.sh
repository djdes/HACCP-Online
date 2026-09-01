#!/usr/bin/env bash
# Проверка перед push — ровно то, что делает CI, и в том же порядке.
#
# Появился после деплоя, который упал на Type-check: локально я смотрел
# вывод через `head`, и ошибки из src/ не попали в первые строки — в
# master уехал код, который не собирается. Здесь вывод не обрезается, а
# ошибки из сгенерированных типов `.next` отфильтрованы: в CI этой папки
# нет, и её ошибки — шум, из-за которого настоящие теряются.
set -uo pipefail

fail=0

echo "=== Type-check ==="
tsc_out="$(npx tsc --noEmit --skipLibCheck 2>&1 || true)"
src_errors="$(printf '%s\n' "$tsc_out" | grep -E '^src/.*error TS' || true)"
if [ -n "$src_errors" ]; then
  printf '%s\n' "$src_errors"
  echo "ОШИБОК В src/: $(printf '%s\n' "$src_errors" | wc -l)"
  fail=1
else
  echo "чисто"
fi

echo
echo "=== Tests ==="
if npm run test:gate 2>&1 | tail -3; then
  :
else
  fail=1
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "НЕ ПУШИТЬ: проверки не прошли."
  exit 1
fi
echo "Можно пушить."
