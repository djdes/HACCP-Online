#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"cold_equipment_control","date":"2026-04-15","source":"employee_app","data":{"readings":[{"equipmentName":"Холодильник №1","temperature":3.5,"time":"08:00"},{"equipmentName":"Морозильник №1","temperature":-18.2,"time":"08:00"}],"note":"Показания в норме"}}'
