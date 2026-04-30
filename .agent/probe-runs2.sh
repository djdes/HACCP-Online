#!/bin/bash
curl -sS "https://api.github.com/repos/djdes/HACCP-Online/actions/runs?per_page=5&branch=master" \
  | jq -r '.workflow_runs[] | "\(.head_sha[:7])\t\(.status)\t\(.conclusion // "-")\t\(.display_title)"' 2>&1 \
  | head -10
