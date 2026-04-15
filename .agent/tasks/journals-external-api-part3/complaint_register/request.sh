#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"complaint_register","date":"2026-04-15","source":"employee_app","data":{"date":"2026-04-15","source":"клиент","content":"Жалоба на пересол блюда","action":"Корректировка рецептуры","responsible":"Шеф-повар","resolved":true}}'
