#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"breakdown_history","date":"2026-04-15","source":"employee_app","data":{"equipmentName":"Холодильник №1","breakdownType":"Утечка хладагента","repairAction":"Заменён компрессор","downtimeHours":4,"cost":12000,"note":"Восстановлено в срок"}}'
