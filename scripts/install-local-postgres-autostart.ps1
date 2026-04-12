$ErrorActionPreference = "Stop"

$repoRoot = "C:\www\Wesetup.ru"
$scriptPath = Join-Path $repoRoot "scripts\start-local-postgres.ps1"
$taskName = "WesetupLocalPostgres"

if (!(Test-Path $scriptPath)) {
  throw "Startup script not found: $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts local PostgreSQL 17 for Wesetup on user logon" `
  -Force | Out-Null

Write-Output "Scheduled task '$taskName' is installed."
