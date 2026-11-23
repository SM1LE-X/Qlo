import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const SELECTORS = {
  hospitalRoot: "0xe30e859e", // hospitalRoot()
  getPolicy: "0x2b07fce3", // getPolicy(uint256)
  insurerEscrow: "0x4432c349", // insurerEscrow(address)
  totalClaimsSettled: "0x29eb2cf4", // totalClaimsSettled()
  paused: "0x5c975abb", // paused()
};

function parseCliLiveUrl() {
  const args = process.argv.slice(2);
  const flagIdx = args.indexOf("--url");
  if (flagIdx >= 0 && args[flagIdx + 1]) {
    return args[flagIdx + 1].replace(/\/$/, "");
  }
  const positional = args.find((a) => /^https?:\/\//i.test(a));
  if (positional) return positional.replace(/\/$/, "");
  if (process.env.LIVE_URL) return process.env.LIVE_URL.replace(/\/$/, "");
  return "";
}

function padUint256Hex(decOrHex) {
  return BigInt(decOrHex).toString(16).padStart(64, "0");
}

function padAddressHex(addr) {
  return addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function rpcCall(rpcs, method, params) {
  let lastErr;
  for (const url of rpcs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      return { result: json.result, rpc: url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`All Base Sepolia RPCs failed for ${method}: ${lastErr?.message || lastErr}`);
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(rootDir, "deployments", "base-sepolia.json"), "utf8")
  );
  const genesis = JSON.parse(
    fs.readFileSync(path.join(rootDir, "contracts", "test", "fixtures", "genesis.json"), "utf8")
  );

  assert.equal(
    deployment.deployed,
    true,
    "deployments/base-sepolia.json has deployed=false. Run scripts/deploy-base-sepolia.ps1 first."
  );
  assert.equal(Number(deployment.chainId), 84532, "Expected Base Sepolia chainId 84532");

  const rpcs = [
    process.env.BASE_SEPOLIA_RPC_URL,
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
    "https://base-sepolia.drpc.org",
  ].filter(Boolean);

  const chainResp = await rpcCall(rpcs, "eth_chainId", []);
  assert.equal(BigInt(chainResp.result), 84532n, `Unexpected chain ID from ${chainResp.rpc}`);
  console.log(`[verify-live] Connected to Base Sepolia (84532) via ${chainResp.rpc}`);

  for (const [name, addr] of Object.entries(deployment.contracts)) {
    assert.ok(
      /^0x[0-9a-fA-F]{40}$/.test(addr) && !/^0x0+$/.test(addr),
      `Invalid deployed address for ${name}: ${addr}`
    );
    const codeResp = await rpcCall(rpcs, "eth_getCode", [addr, "latest"]);
    assert.ok(
      codeResp.result && codeResp.result !== "0x" && codeResp.result.length > 10,
      `No contract bytecode found on Base Sepolia for ${name} at ${addr}`
    );
    console.log(`[verify-live]     ${name} bytecode live at ${addr} (${(codeResp.result.length - 2) / 2} bytes)`);
  }

  // Verify HospitalRegistry.hospitalRoot() matches genesis.json
  const rootResp = await rpcCall(rpcs, "eth_call", [
    { to: deployment.contracts.HospitalRegistry, data: SELECTORS.hospitalRoot },
    "latest",
  ]);
  assert.equal(
    BigInt(rootResp.result),
    BigInt(genesis.hospitalRoot),
    "On-chain HospitalRegistry.hospitalRoot() does not match contracts/test/fixtures/genesis.json"
  );
  console.log(`[verify-live]     HospitalRegistry.hospitalRoot matched genesis (${genesis.hospitalRoot.slice(0, 14)}...)`);

  // Verify active + expired policies were seeded
  for (const [label, commitment] of [
    ["activePolicy", genesis.activePolicyCommitment],
    ["expiredPolicy", genesis.expiredPolicyCommitment],
  ]) {
    const callData = SELECTORS.getPolicy + padUint256Hex(commitment);
    const polResp = await rpcCall(rpcs, "eth_call", [
      { to: deployment.contracts.PolicyRegistry, data: callData },
      "latest",
    ]);
    const hex = polResp.result.replace(/^0x/, "");
    const insurerWord = BigInt("0x" + hex.slice(0, 64));
    const activeWord = BigInt("0x" + hex.slice(64, 128));
    assert.ok(insurerWord > 0n && activeWord === 1n, `${label} not active in PolicyRegistry`);
  }
  console.log("[verify-live]     PolicyRegistry active + expired seeded commitments verified");

  // Verify ClaimsVault escrow & settlement counter readable
  const escrowData = SELECTORS.insurerEscrow + padAddressHex(deployment.seededInsurer);
  const escrowResp = await rpcCall(rpcs, "eth_call", [
    { to: deployment.contracts.ClaimsVault, data: escrowData },
    "latest",
  ]);
  const settledResp = await rpcCall(rpcs, "eth_call", [
    { to: deployment.contracts.ClaimsVault, data: SELECTORS.totalClaimsSettled },
    "latest",
  ]);
  const pausedResp = await rpcCall(rpcs, "eth_call", [
    { to: deployment.contracts.ClaimsVault, data: SELECTORS.paused },
    "latest",
  ]);
  assert.equal(BigInt(pausedResp.result), 0n, "ClaimsVault is paused on Base Sepolia");
  const escrowEth = Number(BigInt(escrowResp.result)) / 1e18;
  console.log(
    `[verify-live]     ClaimsVault seededInsurer=${deployment.seededInsurer} escrow=${escrowEth} ETH, totalClaimsSettled=${BigInt(settledResp.result)}, paused=false`
  );

  // Optional live web URL verification
  const liveUrl = parseCliLiveUrl();
  if (liveUrl) {
    console.log(`[verify-live] Checking live web deployment at ${liveUrl}...`);
    const paths = [
      "/",
      "/patient",
      "/hospital",
      "/insurer",
      "/story",
      "/zk/ClaimValidity.wasm",
      "/zk/ClaimValidity.zkey",
      "/zk/verification_key.json",
      "/zk/manifest.json",
      "/ocr/worker.min.js",
      "/ocr/eng.traineddata.gz",
    ];

    for (const p of paths) {
      const res = await fetch(`${liveUrl}${p}`, { method: p.endsWith(".zkey") || p.endsWith(".wasm") || p.endsWith(".gz") ? "HEAD" : "GET" });
      assert.equal(res.status, 200, `Expected HTTP 200 for ${liveUrl}${p}, got ${res.status}`);
    }

    const healthRes = await fetch(`${liveUrl}/api/health`);
    assert.equal(healthRes.status, 200, `Expected HTTP 200 for ${liveUrl}/api/health, got ${healthRes.status}`);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.ok, true, "Live /api/health returned ok != true");
    assert.equal(Number(healthJson.chainId), 84532, "Live /api/health chainId mismatch");

    const phiProbe = await fetch(`${liveUrl}/api/relay/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        recordCommitmentHex: "0x" + "11".repeat(32),
        icd10Code: "I21.0",
        envelope: {
          version: 1,
          alg: "AES-256-GCM",
          ivBase64: "AAAAAAAAAAAAAAAA",
          ciphertextBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
      }),
    });
    assert.equal(phiProbe.status, 400, "Live relay did not block plaintext PHI payload");
    const phiErr = await phiProbe.json();
    assert.equal(phiErr.error, "ZERO_PHI_POLICY_VIOLATION", "Unexpected Zero-PHI error code");

    const manifest = await (await fetch(`${liveUrl}/zk/manifest.json`)).json();
    assert.equal(
      manifest.zkeySha256,
      deployment.zkeySha256,
      "Live /zk/manifest.json zkeySha256 mismatch vs deployments/base-sepolia.json"
    );
    console.log(`[verify-live]     All 11 web routes + /api/health + Zero-PHI relay probe + ZK/OCR assets passed!`);
  } else {
    console.log("[verify-live] Tip: pass --url https://<your-vercel-app>.vercel.app to also verify the live frontend.");
  }

  console.log("[verify-live] ALL LIVE VERIFICATION CHECKS PASSED!");
}

main().catch((err) => {
  console.error("[verify-live] FAILED:", err);
  process.exit(1);
});
