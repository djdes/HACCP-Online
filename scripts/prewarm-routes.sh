#!/usr/bin/env bash
# Pre-warm Next.js dynamic-route manifests на проде после deploy'а.
#
# Next.js 16 + Turbopack JIT-компилируют client reference manifest
# при первом hit'е каждого route-pattern'а. Пока он не построен,
# первые ~30-90 секунд пользователи видят 500 + InvariantError.
# Особенно заметно на мобильных — пользователь открывает
# /journals/<code> и вместо журнала получает белый экран + 500.
#
# Этот скрипт ходит curl'ом по основным route-pattern'ам сразу после
# pm2-restart, чтобы public traffic шёл уже на готовое.
#
# Вызывается из .github/workflows/deploy.yml. Изменения в этом файле
# можно пушить обычным git push (без workflow-scope в GitHub PAT) —
# в отличие от deploy.yml.

set +e  # non-fatal: prewarm-сбой не должен валить деплой

PORT="${PORT:-3002}"
BASE="http://127.0.0.1:$PORT"

PUBLIC_ROUTES=(
  /
  /blog
  /pricing
  /journals-info
  /dlya-kafe
  /dlya-pekarni
  /dlya-stolovoy
  /dlya-proizvodstva
  /zhurnal-haccp
  /zhurnal-zdorovya
  /elektronnyy-zhurnal-sanpin
  /brakerazhnyy-zhurnal
  /zhurnal-uborki
  /temperaturnyy-list-holodilnika
  /haccp-dlya-kafe
  /sitemap.xml
  /robots.txt
  /login
  /register
  /blog/sanpin-bez-byurokratii
  /journals-info/hygiene
  /features/autofill
)

# Dashboard / journals / mini / settings — приватные routes (redirect
# 307 → /login). Но сам redirect происходит ИЗ page.tsx, что и нужно
# для компиляции manifest'а.
PRIVATE_ROUTES=(
  /dashboard
  /journals
  /reports
  /capa
  /batches
  /losses
  /plans
  /changes
  /competencies
  /journals/cleaning
  /journals/cleaning/new
  /journals/cleaning/guide
  /journals/cleaning/documents/_warm
  /mini
  /mini/journals/cleaning
  /mini/journals/cleaning/new
  /settings
  /settings/users
  /settings/journals
  /settings/audit
  /settings/equipment
  /settings/buildings
  /settings/journal-pipelines
  /settings/journal-responsibles
  /settings/journal-pipelines/cleaning
  /settings/journal-pipelines-tree/cleaning
  /settings/journal-guides-tree/cleaning
  /sanpin
)

# Несуществующий путь — компилирует /_not-found manifest.
NOT_FOUND_TRIGGER="/__deploy-warm-404"

echo "[prewarm] public routes ($(echo "${PUBLIC_ROUTES[@]}" | wc -w))"
for path in "${PUBLIC_ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${BASE}${path}" || echo "ERR")
  echo "  $path → $code"
done

echo "[prewarm] private routes ($(echo "${PRIVATE_ROUTES[@]}" | wc -w))"
for path in "${PRIVATE_ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${BASE}${path}" || echo "ERR")
  echo "  $path → $code"
done

echo "[prewarm] not-found trigger"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${BASE}${NOT_FOUND_TRIGGER}" || echo "ERR")
echo "  $NOT_FOUND_TRIGGER → $code"

echo "[prewarm] done"
