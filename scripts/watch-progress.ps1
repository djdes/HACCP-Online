param(
  [string]$ProgressFile = "docs/agents/progress.md",
  [int]$IntervalSec = 5,
  [int]$StaleMinutes = 3
)

$ErrorActionPreference = "Stop"

function Stamp([string]$msg) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$ts] $msg"
}

function FixPrompt([string]$reason) {
@"
PROMPT FOR AGENT:
Fix reporting now.
Reason: $reason

Do now:
1) Update docs/agents/progress.md with a new step.
2) Include all required fields:
- Time
- What done
- Changed files
- What checked (lint/build/smoke/pdf)
- Result
- Next step
- Blockers
3) If no real progress, write blocker honestly and smallest next action.
"@
}

function Analyze([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return "progress.md is empty"
  }

  $tail = ($text -split "`r?`n") | Select-Object -Last 120
  $joined = ($tail -join "`n").ToLowerInvariant()

  $tokens = @("time", "done", "files", "check", "result", "next", "block")
  foreach ($t in $tokens) {
    if (-not $joined.Contains($t)) {
      return "missing required token: $t"
    }
  }

  return $null
}

Stamp "Start monitor: $ProgressFile (every ${IntervalSec}s)"
$lastHash = ""

while ($true) {
  if (-not (Test-Path -LiteralPath $ProgressFile)) {
    Stamp "BLOCKER: progress file not found"
    Write-Host (FixPrompt "docs/agents/progress.md is missing")
    Start-Sleep -Seconds $IntervalSec
    continue
  }

  $item = Get-Item -LiteralPath $ProgressFile
  $raw = Get-Content -LiteralPath $ProgressFile -Raw
  $hash = [System.BitConverter]::ToString(
    [System.Security.Cryptography.SHA256]::Create().ComputeHash(
      [System.Text.Encoding]::UTF8.GetBytes($raw)
    )
  )

  if ($hash -ne $lastHash) {
    $lastHash = $hash
    Stamp "UPDATE detected"
  }

  $minutesSince = ((Get-Date) - $item.LastWriteTime).TotalMinutes
  $analysis = Analyze $raw

  if ($minutesSince -gt $StaleMinutes) {
    Stamp ("STALE: no updates for {0:N1} min" -f $minutesSince)
    Write-Host (FixPrompt ("no updates for {0:N1} min" -f $minutesSince))
  }

  if ($analysis) {
    Stamp "FORMAT issue: $analysis"
    Write-Host (FixPrompt $analysis)
  }

  Start-Sleep -Seconds $IntervalSec
}
