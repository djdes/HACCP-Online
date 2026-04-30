#!/bin/bash
# HTTP-smoke прода. Каждая строка: <expected> <got> <method> <path>
BASE=https://wesetup.ru
fail=0; pass=0
check() {
  local expected="$1" method="$2" path="$3"
  local got
  got=$(curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" --max-time 10 2>/dev/null || echo "ERR")
  local mark="OK"
  if [ "$got" != "$expected" ]; then mark="FAIL"; fail=$((fail+1)); else pass=$((pass+1)); fi
  printf '%-4s exp=%s got=%s  %s %s\n' "$mark" "$expected" "$got" "$method" "$path"
}

echo "== PUBLIC =="
check 200 GET /
check 200 GET /login
check 200 GET /register
check 200 GET /features
check 200 GET /journals-info
check 200 GET /blog
check 200 GET /privacy 2>/dev/null
check 200 GET /api/external/healthz

echo "== AUTH-PROTECTED (expect 307 redirect to login) =="
check 307 GET /dashboard
check 307 GET /journals
check 307 GET /reports
check 307 GET /capa
check 307 GET /batches
check 307 GET /losses
check 307 GET /plans
check 307 GET /changes
check 307 GET /competencies
check 307 GET /settings
check 307 GET /settings/users
check 307 GET /settings/journals
check 307 GET /settings/equipment
check 307 GET /settings/areas
check 307 GET /settings/notifications
check 307 GET /settings/permissions
check 307 GET /settings/schedule
check 307 GET /settings/audit
check 307 GET /settings/api
check 307 GET /settings/auto-journals
check 307 GET /settings/journal-bonuses
check 307 GET /settings/inspector-portal
check 307 GET /settings/compliance
check 307 GET /settings/onboarding
check 307 GET /settings/staff-hierarchy
check 307 GET /settings/journals-by-position
check 307 GET /settings/products
check 307 GET /settings/phone
check 307 GET /settings/journal-access
check 307 GET /settings/position-staff-visibility
check 307 GET /settings/integrations/tasksflow
check 307 GET /settings/subscription
check 307 GET /settings/backup
check 307 GET /settings/accounting

echo "== ROOT (expect 307 — not signed in as root) =="
check 307 GET /root
check 307 GET /root/metrics
check 307 GET /root/audit-impersonations
check 307 GET /root/blog
check 307 GET /root/feedback
check 307 GET /root/audit
check 307 GET /root/timings
check 307 GET /root/telegram-logs

echo "== MINI =="
check 200 GET /mini

echo "== API (expect 401 без токена) =="
check 401 GET /api/cron/yandex-backup
check 401 GET /api/cron/shift-watcher
check 401 GET /api/cron/tasksflow-escalations
check 401 GET /api/cron/losses-export-1c
check 401 GET /api/cron/compliance
check 401 GET /api/cron/expiry
check 401 GET /api/cron/mini-digest
check 401 GET /api/cron/tuya-pull
check 401 GET /api/cron/weekly-digest
check 401 GET /api/cron/auto-close-shifts
check 401 GET /api/cron/reset-ai-quota
check 401 POST /api/external/sensors
check 401 POST /api/external/entries
check 401 GET /api/external/summary

echo "== API (expect 401 без cookie/session) =="
check 401 POST /api/ai/sanpin-chat
check 401 POST /api/ai/period-report
check 401 GET /api/journals
check 401 GET /api/journal-documents
check 401 GET /api/settings/yandex-backup
check 401 PATCH /api/settings/accountant-email
check 401 PATCH /api/settings/compliance
check 401 GET /api/settings/journals

echo "== Public API =="
check 405 GET /api/public/inn-lookup
check 401 POST /api/support
check 401 POST /api/auth/register/request

echo
echo "PASS=$pass FAIL=$fail"
exit $fail
