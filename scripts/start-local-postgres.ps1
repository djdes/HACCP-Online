$ErrorActionPreference = "Stop"

$pgRoot = Join-Path $HOME "scoop\apps\postgresql17\current"
$binDir = Join-Path $pgRoot "bin"
$dataDir = Join-Path $pgRoot "data"
$logFile = Join-Path $HOME "postgresql17.log"
$pgCtl = Join-Path $binDir "pg_ctl.exe"

if (!(Test-Path $pgCtl)) {
  throw "PostgreSQL 17 is not installed at $pgCtl"
}

if (!(Test-Path $dataDir)) {
  throw "PostgreSQL data directory is missing: $dataDir"
}

$probe = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
if ($probe.TcpTestSucceeded) {
  Write-Output "PostgreSQL is already listening on localhost:5432"
  exit 0
}

& $pgCtl -D $dataDir -l $logFile start | Out-Host
Start-Sleep -Seconds 4

$probe = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
if (-not $probe.TcpTestSucceeded) {
  throw "PostgreSQL failed to start on localhost:5432"
}

Write-Output "PostgreSQL started on localhost:5432"
