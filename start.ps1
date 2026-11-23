param(
  [int]$Port = 3000,
  [switch]$Dev,
  [switch]$Rebuild,
  [switch]$LocalAnvil,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $RootDir "apps\web"
$RuntimeDir = Join-Path $RootDir ".qlo-runtime"
$WebPidFile = Join-Path $RuntimeDir "web.pid"
$AnvilPidFile = Join-Path $RuntimeDir "anvil.pid"
$WebOutLog = Join-Path $RuntimeDir "web.out.log"
$WebErrLog = Join-Path $RuntimeDir "web.err.log"
$AnvilOutLog = Join-Path $RuntimeDir "anvil.out.log"
$AnvilErrLog = Join-Path $RuntimeDir "anvil.err.log"

if (-not (Test-Path $RuntimeDir)) {
  New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
}

function Test-QloHealth {
  param([int]$TargetPort)
  try {
    $uri = "http://127.0.0.1:${TargetPort}/api/health"
    $res = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 2
    return ($null -ne $res -and $res.ok -eq $true)
  } catch {
    return $false
  }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Qlo Protocol -- Zero-Knowledge Health Claims and Records" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. If -Rebuild or -Dev is passed while server is already running, stop existing instance first
if ($Rebuild -or $Dev) {
  & (Join-Path $RootDir "stop.ps1") -Port $Port | Out-Null
} elseif (Test-QloHealth -TargetPort $Port) {
  Write-Host "[qlo:start] Qlo is already running and healthy on http://localhost:${Port}" -ForegroundColor Green
  if ($OpenBrowser) {
    Start-Process "http://localhost:${Port}"
  }
  exit 0
}

# 2. Free port if occupied by a stale/unhealthy process
$existingConn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
  Write-Host "[qlo:start] Port ${Port} is occupied by stale process; stopping it first..." -ForegroundColor Yellow
  & (Join-Path $RootDir "stop.ps1") -Port $Port | Out-Null
}

# 3. Verify dependencies and static ZK / OCR / Sample Bill assets
if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
  Write-Host "[qlo:start] Installing workspace dependencies via pnpm..." -ForegroundColor Cyan
  Push-Location $RootDir
  pnpm install
  Pop-Location
}

$SampleBillPng = Join-Path $WebDir "public\samples\bill-cardiac-er-99285.png"
if (-not (Test-Path $SampleBillPng)) {
  Write-Host "[qlo:start] Generating 5 synthetic CMS-1500 sample medical bills (PNG + JSON)..." -ForegroundColor Cyan
  Push-Location $RootDir
  node scripts/generate-sample-bills.mjs
  Pop-Location
}

# 4. Optional local Anvil EVM node on 127.0.0.1:8545
if ($LocalAnvil) {
  $anvilConn = Get-NetTCPConnection -LocalPort 8545 -State Listen -ErrorAction SilentlyContinue
  if (-not $anvilConn) {
    $anvilExe = "C:\Users\Delta\.foundry\bin\anvil.exe"
    if (-not (Test-Path $anvilExe)) { $anvilExe = "anvil" }
    Write-Host "[qlo:start] Starting local Foundry Anvil node on http://127.0.0.1:8545..." -ForegroundColor Cyan
    $anvilProc = Start-Process -FilePath $anvilExe -ArgumentList "--host 127.0.0.1 --port 8545" -WorkingDirectory $RootDir -WindowStyle Hidden -RedirectStandardOutput $AnvilOutLog -RedirectStandardError $AnvilErrLog -PassThru
    Set-Content -Path $AnvilPidFile -Value $anvilProc.Id
    Write-Host "[qlo:start] Anvil running (PID $($anvilProc.Id))" -ForegroundColor Green
  } else {
    Write-Host "[qlo:start] Port 8545 already has an active listener; skipping Anvil spawn." -ForegroundColor Yellow
  }
}

# 5. Build production bundle if needed (unless -Dev mode)
$BuildIdPath = Join-Path $WebDir ".next\BUILD_ID"
if (-not $Dev) {
  if ($Rebuild -or -not (Test-Path $BuildIdPath)) {
    Write-Host "[qlo:start] Building optimized Next.js production bundle..." -ForegroundColor Cyan
    Push-Location $RootDir
    pnpm --dir apps/web build
    if ($LASTEXITCODE -ne 0) {
      Pop-Location
      throw "Next.js production build failed."
    }
    Pop-Location
  }
}

# 6. Spawn Next.js server in background
$NextBin = Join-Path $WebDir "node_modules\next\dist\bin\next"
$ModeArg = if ($Dev) { "dev" } else { "start" }
Write-Host "[qlo:start] Starting Qlo web server (${ModeArg} mode) on http://localhost:${Port}..." -ForegroundColor Cyan

$webProc = Start-Process -FilePath "node" -ArgumentList "`"$NextBin`" $ModeArg -p $Port" -WorkingDirectory $WebDir -WindowStyle Hidden -RedirectStandardOutput $WebOutLog -RedirectStandardError $WebErrLog -PassThru
Set-Content -Path $WebPidFile -Value $webProc.Id

# 7. Wait for /api/health to report ready
$maxWaitSec = 30
$ready = $false
for ($i = 0; $i -lt ($maxWaitSec * 2); $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-QloHealth -TargetPort $Port) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Host "[qlo:start] ERROR: Server did not become healthy within ${maxWaitSec}s." -ForegroundColor Red
  if (Test-Path $WebErrLog) {
    Get-Content $WebErrLog -Tail 25 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  }
  exit 1
}

$health = Invoke-RestMethod -Uri "http://127.0.0.1:${Port}/api/health" -Method Get
Write-Host ""
Write-Host "  [READY] Qlo Protocol is LIVE!" -ForegroundColor Green
Write-Host "  ------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Process ID       : $($webProc.Id) (saved to .qlo-runtime/web.pid)"
Write-Host "  Network          : $($health.network) (Chain ID $($health.chainId))"
Write-Host "  Overview         : http://localhost:${Port}/"
Write-Host "  Records Vault    : http://localhost:${Port}/patient"
Write-Host "  Claims Prover    : http://localhost:${Port}/hospital"
Write-Host "  Escrow Treasury  : http://localhost:${Port}/insurer"
Write-Host "  Protocol and ABI : http://localhost:${Port}/story"
Write-Host "  Sample Bill #1   : http://localhost:${Port}/samples/bill-cardiac-er-99285.png"
Write-Host "  Logs             : .qlo-runtime/web.out.log"
Write-Host "  Stop Command     : .\stop.ps1   (or: pnpm stop)"
Write-Host "================================================================" -ForegroundColor Cyan

if ($OpenBrowser) {
  Start-Process "http://localhost:${Port}"
}
