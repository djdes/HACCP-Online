#!/bin/bash
set -eo pipefail
TMP=$(mktemp)
curl -sS -A "wesetup-cli" "https://api.github.com/repos/djdes/HACCP-Online/actions/runs?per_page=50&branch=master" > "$TMP"
jq -r '.workflow_runs[] | "\(.head_sha | .[0:7])\t\(.status)\t\(.conclusion // "-")\t\(.display_title | .[0:60])"' < "$TMP"
rm "$TMP"
