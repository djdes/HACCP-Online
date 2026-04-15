#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"audit_plan","date":"2026-04-15","source":"employee_app","data":{"auditTopic":"Проверка процессов приёмки сырья","scheduledAt":"2026-04-15","auditor":"Технолог","scope":"Склад, горячий цех"}}'
