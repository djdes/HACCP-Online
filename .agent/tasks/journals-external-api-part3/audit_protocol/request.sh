#!/usr/bin/env bash
# Masked token — set EXTERNAL_API_TOKEN env before running.
set -euo pipefail
curl -sS -X POST "https://wesetup.ru/api/external/entries" \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"organizationId":"cmnm40ikt00002ktseet6fd5y","journalCode":"audit_protocol","date":"2026-04-15","source":"employee_app","data":{"auditTopic":"Проверка соблюдения температурных режимов","conductedAt":"2026-04-15","auditor":"Технолог","findings":"Незначительные отклонения не выявлены","score":95}}'
