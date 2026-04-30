#!/bin/bash
curl -sS "https://api.github.com/repos/djdes/HACCP-Online/actions/runs?per_page=40&branch=master" \
  | jq -r '.workflow_runs[] | "\(.head_sha[:7])\t\(.status)\t\(.conclusion // "n/a")\t\(.created_at)\t\(.display_title)"'
