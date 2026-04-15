#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"traceability_test","date":"2026-04-15","source":"employee_app","data":{"batchCode":"BATCH-2026-04-0001","productName":"Суп куриный","supplierChain":["ООО «Мясокомбинат»","ООО «Овощебаза»"],"result":"пройдено","note":"Прослеживаемость восстановлена за 15 минут"}}'
