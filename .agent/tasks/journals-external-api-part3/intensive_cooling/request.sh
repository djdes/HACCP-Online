#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"intensive_cooling","date":"2026-04-15","source":"employee_app","data":{"productName":"Гуляш","startTime":"12:00","endTime":"13:30","startTemp":75,"endTemp":4,"equipmentName":"Шкаф интенсивного охлаждения","result":"pass"}}'
