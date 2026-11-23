$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$deployPath = Join-Path $root "deployments\sepolia.json"
$deployment = Get-Content -Raw $deployPath | ConvertFrom-Json

if (-not $deployment.deployed) {
    throw "deployments/sepolia.json reports deployed=false. Run DeploySepolia.s.sol first."
}

$forge = Join-Path $env:USERPROFILE ".foundry\bin\forge.exe"
$contracts = @(
    @{ Name = "Groth16Verifier"; Target = "src/Groth16Verifier.sol:Groth16Verifier"; Addr = $deployment.contracts.Groth16Verifier },
    @{ Name = "HospitalRegistry"; Target = "src/HospitalRegistry.sol:HospitalRegistry"; Addr = $deployment.contracts.HospitalRegistry },
    @{ Name = "PolicyRegistry"; Target = "src/PolicyRegistry.sol:PolicyRegistry"; Addr = $deployment.contracts.PolicyRegistry },
    @{ Name = "HealthRecords"; Target = "src/HealthRecords.sol:HealthRecords"; Addr = $deployment.contracts.HealthRecords },
    @{ Name = "ClaimsVault"; Target = "src/ClaimsVault.sol:ClaimsVault"; Addr = $deployment.contracts.ClaimsVault }
)

Set-Location (Join-Path $root "contracts")

foreach ($c in $contracts) {
    Write-Host "[Sourcify] Verifying $($c.Name) at $($c.Addr)..."
    & $forge verify-contract --chain-id 11155111 --verifier sourcify --watch $c.Addr $c.Target

    if ($env:ETHERSCAN_API_KEY) {
        Write-Host "[Etherscan V2] Verifying $($c.Name) at $($c.Addr)..."
        & $forge verify-contract --verifier etherscan --verifier-url "https://api.etherscan.io/v2/api?chainid=11155111" --etherscan-api-key $env:ETHERSCAN_API_KEY --watch $c.Addr $c.Target
    }
}
