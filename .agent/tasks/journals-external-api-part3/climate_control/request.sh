#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"climate_control","date":"2026-04-15","source":"employee_app","data":{"measurements":[{"time":"10:00","temperature":22.4,"humidity":54},{"time":"17:00","temperature":23.1,"humidity":56}],"roomName":"Склад","note":"Параметры в норме"}}'
