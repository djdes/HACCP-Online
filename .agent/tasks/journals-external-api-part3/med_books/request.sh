#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"med_books","date":"2026-04-15","source":"employee_app","data":{"employeeName":"Иванов И.И.","medBookNumber":"МК-00123","lastExam":"2026-01-15","nextExam":"2026-07-15","vaccinations":[{"name":"Дифтерия","status":"done","date":"2025-03-10"},{"name":"Гепатит А","status":"done","date":"2025-06-20"}],"note":"Медосмотр пройден"}}'
