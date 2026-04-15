#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"fryer_oil","date":"2026-04-15","source":"employee_app","data":{"tpm":18,"qualityScore":3,"action":"continue","equipment":"Фритюрница №1","oilType":"Подсолнечное","productType":"Картофель фри","note":"TPM в пределах нормы"}}'
