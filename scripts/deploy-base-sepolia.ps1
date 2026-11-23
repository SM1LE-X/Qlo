$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        if ($key) {
            [Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
    Write-Host "[deploy] Loaded environment variables from .env"
}

$pkRaw = [Environment]::GetEnvironmentVariable("DEPLOYER_PRIVATE_KEY", "Process")
if (-not $pkRaw) {
    throw "DEPLOYER_PRIVATE_KEY is missing. Copy .env.example to .env and set a funded Base Sepolia private key."
}

$pkTrimmed = $pkRaw.Trim()
if ($pkTrimmed -notmatch "^(0x)?[0-9a-fA-F]{64}$") {
    throw "DEPLOYER_PRIVATE_KEY must be a valid 32-byte (64-hex) private key."
}
$pkNormalized = if ($pkTrimmed.StartsWith("0x")) { $pkTrimmed } else { "0x$pkTrimmed" }
[Environment]::SetEnvironmentVariable("DEPLOYER_PRIVATE_KEY", $pkNormalized, "Process")

$rpcUrl = [Environment]::GetEnvironmentVariable("BASE_SEPOLIA_RPC_URL", "Process")
if (-not $rpcUrl) {
    $rpcUrl = "https://sepolia.base.org"
    [Environment]::SetEnvironmentVariable("BASE_SEPOLIA_RPC_URL", $rpcUrl, "Process")
}

$foundryBin = Join-Path $env:USERPROFILE ".foundry\bin"
$forge = Join-Path $foundryBin "forge.exe"
$cast = Join-Path $foundryBin "cast.exe"
if (-not (Test-Path $forge) -or -not (Test-Path $cast)) {
    throw "Foundry binaries not found in $foundryBin. Install Foundry first."
}

$deployerAddress = (& $cast wallet address --private-key $pkNormalized).Trim()
if ($LASTEXITCODE -ne 0 -or -not $deployerAddress) {
    throw "Failed to derive deployer address from DEPLOYER_PRIVATE_KEY."
}
Write-Host "[deploy] Deployer wallet: $deployerAddress"
Write-Host "[deploy] Target RPC: $rpcUrl (Chain ID 84532)"

$balanceWeiStr = (& $cast balance $deployerAddress --rpc-url $rpcUrl).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Failed to query Base Sepolia ETH balance on $rpcUrl."
}
$balanceWei = [decimal]::Parse($balanceWeiStr)
$minWei = [decimal]::Parse("5000000000000000") # 0.005 ETH minimum gas margin
if ($balanceWei -lt $minWei) {
    throw "Insufficient Base Sepolia ETH ($balanceWeiStr wei) on $deployerAddress. Fund ~0.05 Base Sepolia ETH via https://www.alchemy.com/faucets/base-sepolia or https://faucet.quicknode.com/base/sepolia."
}
$balanceEth = [math]::Round([double]($balanceWei / 1000000000000000000), 5)
Write-Host "[deploy] Deployer balance: $balanceEth ETH"

if (-not [Environment]::GetEnvironmentVariable("EXTRA_HOSPITAL_ADDRESS", "Process")) {
    [Environment]::SetEnvironmentVariable("EXTRA_HOSPITAL_ADDRESS", $deployerAddress, "Process")
    Write-Host "[deploy] EXTRA_HOSPITAL_ADDRESS defaulted to deployer wallet for 1-wallet 3-role demo"
}
if (-not [Environment]::GetEnvironmentVariable("EXTRA_HOSPITAL_NPI", "Process")) {
    [Environment]::SetEnvironmentVariable("EXTRA_HOSPITAL_NPI", "1234567890", "Process")
}

Write-Host "[deploy] Regenerating Poseidon hospitalRoot fixtures with accredited wallet..."
& node (Join-Path $root "circuits\scripts\generate-fixtures.mjs")
if ($LASTEXITCODE -ne 0) { throw "generate-fixtures.mjs failed." }

Write-Host "[deploy] Broadcasting DeployBaseSepolia.s.sol to Base Sepolia..."
Push-Location (Join-Path $root "contracts")
try {
    & $forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia --rpc-url $rpcUrl --chain-id 84532 --broadcast
    if ($LASTEXITCODE -ne 0) { throw "forge script broadcast failed." }
} finally {
    Pop-Location
}

Write-Host "[deploy] Exporting ABIs and deployment manifest to apps/web..."
& node (Join-Path $root "contracts\script\export-abis.mjs")
if ($LASTEXITCODE -ne 0) { throw "export-abis.mjs failed." }

Write-Host "[deploy] Verifying contract sources on Sourcify (and Basescan if ETHERSCAN_API_KEY set)..."
& powershell -ExecutionPolicy Bypass -File (Join-Path $root "contracts\script\verify-base-sepolia.ps1")
if ($LASTEXITCODE -ne 0) { Write-Warning "Contract source verification exited non-zero; re-run contracts/script/verify-base-sepolia.ps1 if needed." }

Write-Host "[deploy] Running live Base Sepolia smoke checks..."
& node (Join-Path $root "scripts\verify-live.mjs")
if ($LASTEXITCODE -ne 0) { throw "verify-live.mjs failed." }

Write-Host "[deploy] Base Sepolia deployment complete! Next: deploy apps/web to Vercel Hobby and run: node scripts/verify-live.mjs --url https://<your-app>.vercel.app"
