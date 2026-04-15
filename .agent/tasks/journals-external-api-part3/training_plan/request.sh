#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"training_plan","date":"2026-04-15","source":"employee_app","data":{"topic":"Санитарные требования при обработке сырья","scheduledAt":"2026-04-15","durationHours":2,"format":"очно","note":"План на квартал"}}'
