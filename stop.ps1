param(
  [int]$Port = 3000,
  [int]$AnvilPort = 8545,
  [switch]$CleanCache
)

$ErrorActionPreference = "SilentlyContinue"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeDir = Join-Path $RootDir ".qlo-runtime"
$WebPidFile = Join-Path $RuntimeDir "web.pid"
$AnvilPidFile = Join-Path $RuntimeDir "anvil.pid"

Write-Host "[qlo:stop] Shutting down Qlo Protocol services..." -ForegroundColor Cyan

function Stop-ProcessTree {
  param([int]$TargetPid, [string]$Label)
  if ($TargetPid -gt 0) {
    $proc = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "[qlo:stop] Stopping $Label (PID $TargetPid)..." -ForegroundColor Yellow
      & taskkill /PID $TargetPid /T /F 2>$null | Out-Null
      Stop-Process -Id $TargetPid -Force -ErrorAction SilentlyContinue
    }
  }
}

# 1. Stop tracked PIDs from .qlo-runtime
if (Test-Path $WebPidFile) {
  $savedWebPid = [int](Get-Content $WebPidFile | Select-Object -First 1)
  Stop-ProcessTree -TargetPid $savedWebPid -Label "Qlo Next.js Server"
  Remove-Item $WebPidFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path $AnvilPidFile) {
  $savedAnvilPid = [int](Get-Content $AnvilPidFile | Select-Object -First 1)
  Stop-ProcessTree -TargetPid $savedAnvilPid -Label "Foundry Anvil Node"
  Remove-Item $AnvilPidFile -Force -ErrorAction SilentlyContinue
}

# 2. Ensure any process listening on $Port (3000) is stopped
$portConns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portConns) {
  $owningPids = $portConns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($owningPid in $owningPids) {
    if ($owningPid -gt 4) {
      Stop-ProcessTree -TargetPid $owningPid -Label "Port $Port Listener"
    }
  }
}

# 3. Stop any anvil.exe process listening on $AnvilPort (8545)
$anvilConns = Get-NetTCPConnection -LocalPort $AnvilPort -State Listen -ErrorAction SilentlyContinue
if ($anvilConns) {
  $anvilPids = $anvilConns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($aPid in $anvilPids) {
    $p = Get-Process -Id $aPid -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -match "anvil") {
      Stop-ProcessTree -TargetPid $aPid -Label "Port $AnvilPort Anvil Listener"
    }
  }
}

# 4. Optionally clean temporary Zero-PHI relay disk cache
if ($CleanCache) {
  $vaultCache = Join-Path $env:TEMP "qlo-zero-phi-vault.json"
  if (Test-Path $vaultCache) {
    Remove-Item $vaultCache -Force -ErrorAction SilentlyContinue
    Write-Host "[qlo:stop] Cleared temporary Zero-PHI relay cache ($vaultCache)." -ForegroundColor DarkGray
  }
}

Start-Sleep -Milliseconds 400
$stillListening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($stillListening) {
  Write-Host "[qlo:stop] WARNING: Port $Port still reports a listener." -ForegroundColor Red
  exit 1
} else {
  Write-Host "[qlo:stop] All Qlo services stopped cleanly. Port $Port is free." -ForegroundColor Green
  exit 0
}
