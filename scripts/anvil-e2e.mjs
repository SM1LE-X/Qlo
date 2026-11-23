import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const deployPath = path.join(rootDir, "deployments", "base-sepolia.json");
const webDeployPath = path.join(rootDir, "apps", "web", "src", "contracts", "deployment.json");

const foundryBin = path.join(process.env.USERPROFILE || "C:\\Users\\Delta", ".foundry", "bin");
const ANVIL = fs.existsSync(path.join(foundryBin, "anvil.exe"))
  ? path.join(foundryBin, "anvil.exe")
  : "C:\\Users\\Delta\\.foundry\\bin\\anvil.exe";
const FORGE = fs.existsSync(path.join(foundryBin, "forge.exe"))
  ? path.join(foundryBin, "forge.exe")
  : "C:\\Users\\Delta\\.foundry\\bin\\forge.exe";
const CAST = fs.existsSync(path.join(foundryBin, "cast.exe"))
  ? path.join(foundryBin, "cast.exe")
  : "C:\\Users\\Delta\\.foundry\\bin\\cast.exe";

const RPC_URL = "http://127.0.0.1:8545";
const DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PATIENT_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const HOSPITAL_PK = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

function runCast(args, allowFail = false) {
  try {
    return execFileSync(CAST, [...args, "--rpc-url", RPC_URL], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (allowFail) {
      return {
        failed: true,
        output: `${err.stdout || ""}\n${err.stderr || ""}\n${err.message || ""}`,
      };
    }
    throw err;
  }
}

function formatSubmitClaimArgs(fixture) {
  const pA = `[${fixture.pA[0]},${fixture.pA[1]}]`;
  const pB = `[[${fixture.pB[0][0]},${fixture.pB[0][1]}],[${fixture.pB[1][0]},${fixture.pB[1][1]}]]`;
  const pC = `[${fixture.pC[0]},${fixture.pC[1]}]`;
  const pub = `[${fixture.pubSignals.join(",")}]`;
  return [pA, pB, pC, pub];
}

async function waitForAnvil(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      });
      if (res.ok) return;
    } catch {
      // Anvil starting
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Timed out waiting for local Anvil RPC");
}

async function main() {
  const hadDeploy = fs.existsSync(deployPath);
  const deployBackup = hadDeploy ? fs.readFileSync(deployPath, "utf8") : null;
  const hadWebDeploy = fs.existsSync(webDeployPath);
  const webDeployBackup = hadWebDeploy ? fs.readFileSync(webDeployPath, "utf8") : null;

  console.log("[anvil-e2e] Starting local Anvil Base Sepolia fork-chain (84532)...");
  const anvil = spawn(
    ANVIL,
    ["--chain-id", "84532", "--port", "8545", "--timestamp", "1795300080", "--silent"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  try {
    await waitForAnvil();

    console.log("[anvil-e2e] Broadcasting DeployBaseSepolia.s.sol via forge script...");
    execFileSync(
      FORGE,
      [
        "script",
        "script/DeployBaseSepolia.s.sol:DeployBaseSepolia",
        "--rpc-url",
        RPC_URL,
        "--broadcast",
      ],
      {
        cwd: contractsDir,
        env: {
          ...process.env,
          DEPLOYER_PRIVATE_KEY: DEPLOYER_PK,
          INITIAL_ESCROW_WEI: "100000000000000000", // 0.1 ETH
        },
        stdio: "inherit",
      }
    );

    const deployed = JSON.parse(fs.readFileSync(deployPath, "utf8"));
    const genesis = JSON.parse(
      fs.readFileSync(path.join(contractsDir, "test", "fixtures", "genesis.json"), "utf8")
    );
    const c1 = JSON.parse(
      fs.readFileSync(path.join(contractsDir, "test", "fixtures", "claim1_proof.json"), "utf8")
    );
    const c2 = JSON.parse(
      fs.readFileSync(path.join(contractsDir, "test", "fixtures", "claim2_proof.json"), "utf8")
    );

    assert.equal(deployed.deployed, true);
    assert.equal(deployed.chainId, 84532);

    const { HospitalRegistry, PolicyRegistry, HealthRecords, ClaimsVault } = deployed.contracts;

    // 1. Verify genesis on-chain state
    const onChainRoot = runCast(["call", HospitalRegistry, "hospitalRoot()(uint256)"]);
    assert.ok(
      onChainRoot.startsWith(genesis.hospitalRootDec),
      `Root mismatch: ${onChainRoot} vs ${genesis.hospitalRootDec}`
    );

    const escrowWei = runCast([
      "call",
      ClaimsVault,
      "insurerEscrow(address)(uint256)",
      genesis.accounts.deployer,
    ]);
    assert.ok(escrowWei.startsWith("100000000000000000"), `Escrow mismatch: ${escrowWei}`);
    console.log("[anvil-e2e] 1/5 Verified deployed HospitalRegistry root & 0.1 ETH insurer escrow");

    // 2. Patient registers both records and grants Hospital access
    const dummyDek = "0x04112233445566778899aabbccddeeff04112233445566778899aabbccddeeff";
    runCast([
      "send",
      HealthRecords,
      "registerRecord(bytes32,string)",
      c1.pubSignals[5],
      c1.cid,
      "--private-key",
      PATIENT_PK,
    ]);
    runCast([
      "send",
      HealthRecords,
      "grantAccess(uint256,address,uint64,bytes)",
      "1",
      genesis.accounts.hospital1,
      "600",
      dummyDek,
      "--private-key",
      PATIENT_PK,
    ]);
    runCast([
      "send",
      HealthRecords,
      "registerRecord(bytes32,string)",
      c2.pubSignals[5],
      c2.cid,
      "--private-key",
      PATIENT_PK,
    ]);
    runCast([
      "send",
      HealthRecords,
      "grantAccess(uint256,address,uint64,bytes)",
      "2",
      genesis.accounts.hospital1,
      "600",
      dummyDek,
      "--private-key",
      PATIENT_PK,
    ]);
    console.log("[anvil-e2e] 2/5 Patient registered Records #1 & #2 and granted 10m access");

    // 3. Hospital settles Claim #1 with real Groth16 proof
    const balBefore = BigInt(runCast(["balance", genesis.accounts.hospital1]));
    const receiptRaw = runCast([
      "send",
      ClaimsVault,
      "submitClaim(uint256[2],uint256[2][2],uint256[2],uint256[8])",
      ...formatSubmitClaimArgs(c1),
      "--private-key",
      HOSPITAL_PK,
      "--json",
    ]);
    const receipt = JSON.parse(receiptRaw);
    assert.equal(receipt.status, "0x1", "Claim #1 submitClaim failed");

    const balAfter = BigInt(runCast(["balance", genesis.accounts.hospital1]));
    assert.ok(balAfter - balBefore > 9_000_000_000_000_000n, "Hospital did not receive +0.01 ETH net payout");

    const policySpent = runCast([
      "call",
      ClaimsVault,
      "policySpent(uint256)(uint256)",
      c1.pubSignals[1],
    ]);
    assert.ok(policySpent.startsWith("10000000000000000"), `Unexpected policySpent: ${policySpent}`);

    // Scan mined transaction raw calldata for zero PHI
    const txJson = JSON.parse(runCast(["tx", receipt.transactionHash, "--json"]));
    const inputLower = String(txJson.input || "").toLowerCase();
    for (const phi of ["I21.0", "99285", "Ticagrelor", "Aspirin"]) {
      const hexNeedle = Buffer.from(phi, "utf8").toString("hex").toLowerCase();
      assert.ok(!inputLower.includes(hexNeedle), `PHI term ${phi} found in tx input!`);
    }
    console.log(`[anvil-e2e] 3/5 Settled Claim #1 on local EVM (tx ${receipt.transactionHash.slice(0, 14)}..., 0 PHI bytes)`);

    // 4. Replay attack must revert with NullifierAlreadyUsed()
    const replaySig = execFileSync(CAST, ["sig", "NullifierAlreadyUsed()"], { encoding: "utf8" }).trim();
    const replayRes = runCast(
      [
        "call",
        ClaimsVault,
        "submitClaim(uint256[2],uint256[2][2],uint256[2],uint256[8])",
        ...formatSubmitClaimArgs(c1),
        "--from",
        genesis.accounts.hospital1,
      ],
      true
    );
    assert.ok(replayRes.failed, "Replay attack unexpectedly succeeded");
    assert.ok(
      replayRes.output.includes("NullifierAlreadyUsed") || replayRes.output.includes(replaySig),
      `Unexpected replay revert: ${replayRes.output}`
    );
    console.log(`[anvil-e2e] 4/5 Replay attack reverted on-chain (${replaySig})`);

    // 5. Patient revokes Record #2 -> Hospital Claim #2 must revert with PatientAccessNotActive()
    runCast([
      "send",
      HealthRecords,
      "revokeAccess(uint256,address)",
      "2",
      genesis.accounts.hospital1,
      "--private-key",
      PATIENT_PK,
    ]);
    const revokeSig = execFileSync(CAST, ["sig", "PatientAccessNotActive()"], { encoding: "utf8" }).trim();
    const revokeRes = runCast(
      [
        "call",
        ClaimsVault,
        "submitClaim(uint256[2],uint256[2][2],uint256[2],uint256[8])",
        ...formatSubmitClaimArgs(c2),
        "--from",
        genesis.accounts.hospital1,
      ],
      true
    );
    assert.ok(revokeRes.failed, "Post-revoke claim unexpectedly succeeded");
    assert.ok(
      revokeRes.output.includes("PatientAccessNotActive") || revokeRes.output.includes(revokeSig),
      `Unexpected post-revoke revert: ${revokeRes.output}`
    );
    console.log(`[anvil-e2e] 5/5 Post-revoke Claim #2 blocked on-chain (${revokeSig})`);

    console.log("[anvil-e2e] ALL 5 LOCAL ANVIL DEPLOY + LIVE JSON-RPC E2E CHECKS PASSED!");
  } finally {
    anvil.kill("SIGTERM");
    if (deployBackup !== null) fs.writeFileSync(deployPath, deployBackup);
    if (webDeployBackup !== null) fs.writeFileSync(webDeployPath, webDeployBackup);
    const broadcastRunDir = path.join(contractsDir, "broadcast");
    if (fs.existsSync(broadcastRunDir)) {
      fs.rmSync(broadcastRunDir, { recursive: true, force: true });
    }
  }
}

main().catch((err) => {
  console.error("[anvil-e2e] FAILED:", err);
  process.exit(1);
});
