#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"glass_items_list","date":"2026-04-15","source":"employee_app","data":{"items":[{"name":"Стеклянная банка","area":"Склад","count":5},{"name":"Мерный стакан","area":"Горячий цех","count":2}],"note":"Перечень актуализирован"}}'
