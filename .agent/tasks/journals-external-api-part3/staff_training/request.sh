#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"staff_training","date":"2026-04-15","source":"employee_app","data":{"topic":"Входной инструктаж по СанПиН","trainerName":"Шеф-повар","durationHours":1,"trainees":["Иванов И.И.","Петров П.П."],"signed":true,"note":"Инструктаж проведён"}}'
