#!/bin/bash
curl -sS -A "wesetup-cli" "https://api.github.com/repos/djdes/HACCP-Online/actions/runs?per_page=50&branch=master" -o /tmp/_runs.json
jq -r '.workflow_runs[] | (.head_sha | .[0:7]) + "|" + .status + "|" + (.conclusion // "-") + "|" + (.display_title | .[0:55])' /tmp/_runs.json
