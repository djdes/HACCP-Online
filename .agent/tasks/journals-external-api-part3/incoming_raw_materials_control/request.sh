#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"incoming_raw_materials_control","date":"2026-04-15","source":"employee_app","data":{"supplier":"ООО «Мясокомбинат»","productName":"Курица охлаждённая","quantity":15,"unit":"кг","temperature":2.5,"packageOk":true,"docsOk":true,"result":"pass","note":"Приёмка разрешена"}}'
