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
    throw "DEPLOYER_PRIVATE_KEY is missing. Copy .env.example to .env and set a funded Ethereum Sepolia private key."
}

$pkTrimmed = $pkRaw.Trim()
if ($pkTrimmed -notmatch "^(0x)?[0-9a-fA-F]{64}$") {
    throw "DEPLOYER_PRIVATE_KEY must be a valid 32-byte (64-hex) private key."
}
$pkNormalized = if ($pkTrimmed.StartsWith("0x")) { $pkTrimmed } else { "0x$pkTrimmed" }
[Environment]::SetEnvironmentVariable("DEPLOYER_PRIVATE_KEY", $pkNormalized, "Process")

$foundryBin = Join-Path $env:USERPROFILE ".foundry\bin"
$forge = Join-Path $foundryBin "forge.exe"
$cast = Join-Path $foundryBin "cast.exe"
if (-not (Test-Path $forge) -or -not (Test-Path $cast)) {
    throw "Foundry binaries not found in $foundryBin. Install Foundry first."
}

$customRpc = [Environment]::GetEnvironmentVariable("SEPOLIA_RPC_URL", "Process")
$rpcCandidates = @(
    $customRpc,
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://1rpc.io/sepolia",
    "https://sepolia.gateway.tenderly.co"
) | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique

$rpcUrl = ""
foreach ($candidate in $rpcCandidates) {
    try {
        $probeChain = (& $cast chain-id --rpc-url $candidate 2>$null).Trim()
        if ($LASTEXITCODE -eq 0 -and $probeChain -eq "11155111") {
            $rpcUrl = $candidate
            break
        }
    } catch {
        # Try next public RPC endpoint
    }
}
if (-not $rpcUrl) {
    throw "Unable to reach a live Ethereum Sepolia RPC (Chain ID 11155111). Check your network or set SEPOLIA_RPC_URL in .env."
}
[Environment]::SetEnvironmentVariable("SEPOLIA_RPC_URL", $rpcUrl, "Process")

$deployerAddress = (& $cast wallet address --private-key $pkNormalized).Trim()
if ($LASTEXITCODE -ne 0 -or -not $deployerAddress) {
    throw "Failed to derive deployer address from DEPLOYER_PRIVATE_KEY."
}
Write-Host "[deploy] Deployer wallet: $deployerAddress"
Write-Host "[deploy] Target RPC: $rpcUrl (Chain ID 11155111)"

$balanceWeiStr = (& $cast balance $deployerAddress --rpc-url $rpcUrl).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Failed to query Ethereum Sepolia ETH balance on $rpcUrl."
}
$balanceWei = [decimal]::Parse($balanceWeiStr)
$minWei = [decimal]::Parse("5000000000000000") # 0.005 ETH minimum gas margin
if ($balanceWei -lt $minWei) {
    throw "Insufficient Ethereum Sepolia ETH ($balanceWeiStr wei) on $deployerAddress. Fund ~0.05 SepoliaETH via a free Ethereum Sepolia faucet."
}
$recommendedWei = [decimal]::Parse("28000000000000000") # 0.028 ETH recommended for full 0.02 ETH escrow + L1 gas reserve
if ($balanceWei -lt $recommendedWei) {
    Write-Warning "Deployer holds under 0.028 ETH; DeploySepolia.s.sol will automatically scale initial escrow deposit cleanly above the 0.008 ETH gas reserve."
}
$balanceEth = [math]::Round([double]($balanceWei / 1000000000000000000), 5)
Write-Host "[deploy] Deployer balance: $balanceEth ETH"

$existingExtrasRaw = @(
    [Environment]::GetEnvironmentVariable("EXTRA_HOSPITAL_ADDRESS", "Process"),
    [Environment]::GetEnvironmentVariable("EXTRA_HOSPITAL_ADDRESSES", "Process")
) | Where-Object { $_ -and $_.Trim() -ne "" }

$rawHospitalList = @($deployerAddress)
foreach ($rawChunk in $existingExtrasRaw) {
    foreach ($candidateAddr in ($rawChunk -split ",")) {
        $trimmedAddr = $candidateAddr.Trim()
        if (-not $trimmedAddr) { continue }
        if ($trimmedAddr -notmatch "^0x[0-9a-fA-F]{40}$") {
            throw "Invalid EXTRA_HOSPITAL_ADDRESS entry '$trimmedAddr'. Expected 20-byte 0x Ethereum address."
        }
        $rawHospitalList += $trimmedAddr
    }
}

$seenLower = @{}
$mergedHospitals = @()
foreach ($addr in $rawHospitalList) {
    $lower = $addr.ToLowerInvariant()
    if (-not $seenLower.ContainsKey($lower)) {
        $seenLower[$lower] = $true
        $mergedHospitals += $addr
    }
}

$mergedHospitalCsv = $mergedHospitals -join ","
[Environment]::SetEnvironmentVariable("EXTRA_HOSPITAL_ADDRESS", $mergedHospitalCsv, "Process")
Write-Host "[deploy] Accredited extra hospital wallets in Poseidon root: $mergedHospitalCsv"

if (-not [Environment]::GetEnvironmentVariable("EXTRA_HOSPITAL_NPI", "Process")) {
    [Environment]::SetEnvironmentVariable("EXTRA_HOSPITAL_NPI", "1234567890", "Process")
}

Write-Host "[deploy] Regenerating Poseidon hospitalRoot fixtures with accredited wallet..."
& node (Join-Path $root "circuits\scripts\generate-fixtures.mjs")
if ($LASTEXITCODE -ne 0) { throw "generate-fixtures.mjs failed." }

Write-Host "[deploy] Broadcasting DeploySepolia.s.sol to Ethereum Sepolia..."
Push-Location (Join-Path $root "contracts")
try {
    & $forge script script/DeploySepolia.s.sol:DeploySepolia --rpc-url $rpcUrl --chain-id 11155111 --broadcast
    if ($LASTEXITCODE -ne 0) { throw "forge script broadcast failed." }
} finally {
    Pop-Location
}

Write-Host "[deploy] Exporting ABIs and deployment manifest to apps/web..."
& node (Join-Path $root "contracts\script\export-abis.mjs")
if ($LASTEXITCODE -ne 0) { throw "export-abis.mjs failed." }

Write-Host "[deploy] Verifying contract sources on Sourcify (and Etherscan if ETHERSCAN_API_KEY set)..."
& powershell -ExecutionPolicy Bypass -File (Join-Path $root "contracts\script\verify-sepolia.ps1")
if ($LASTEXITCODE -ne 0) { Write-Warning "Contract source verification exited non-zero; re-run contracts/script/verify-sepolia.ps1 if needed." }

Write-Host "[deploy] Running live Ethereum Sepolia smoke checks..."
& node (Join-Path $root "scripts\verify-live.mjs")
if ($LASTEXITCODE -ne 0) { throw "verify-live.mjs failed." }

Write-Host "[deploy] Ethereum Sepolia deployment complete! Next: deploy apps/web to Vercel Hobby and run: node scripts/verify-live.mjs --url https://<your-app>.vercel.app"
