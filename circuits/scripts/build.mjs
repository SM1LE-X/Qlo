import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const circuitsDir = path.resolve(__dirname, "..");
const buildDir = path.join(circuitsDir, "build");
const webZkDir = path.join(rootDir, "apps", "web", "public", "zk");
const verifierOutPath = path.join(rootDir, "contracts", "src", "Groth16Verifier.sol");

const ptauPath = path.join(buildDir, "ppot_0080_13.ptau");
const circuitSrc = path.join(circuitsDir, "src", "ClaimValidity.circom");
const r1csPath = path.join(buildDir, "ClaimValidity.r1cs");
const wasmPath = path.join(buildDir, "ClaimValidity_js", "ClaimValidity.wasm");
const zkey0Path = path.join(buildDir, "ClaimValidity_0000.zkey");
const finalZkeyPath = path.join(buildDir, "ClaimValidity.zkey");
const vkeyPath = path.join(buildDir, "verification_key.json");
const manifestPath = path.join(buildDir, "manifest.json");

function resolveCircomBin() {
  const localWin = path.join(rootDir, "tools", "circom.exe");
  if (fs.existsSync(localWin)) return localWin;
  const localUnix = path.join(rootDir, "tools", "circom");
  if (fs.existsSync(localUnix)) return localUnix;
  return "circom";
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(webZkDir, { recursive: true });
  fs.mkdirSync(path.dirname(verifierOutPath), { recursive: true });

  if (!fs.existsSync(ptauPath)) {
    throw new Error(`Missing ptau file at ${ptauPath}. Run download-ptau.mjs first.`);
  }

  const circomBin = resolveCircomBin();
  console.log(`[build] Compiling ${circuitSrc} using ${circomBin} (--O2)...`);
  execFileSync(circomBin, [circuitSrc, "--r1cs", "--wasm", "--sym", "--O2", "-o", buildDir], {
    cwd: circuitsDir,
    stdio: "inherit",
  });

  const info = await snarkjs.r1cs.info(r1csPath);
  console.log(
    `[build] R1CS Constraints: ${info.nConstraints}, Wires: ${info.nVars}, Public Inputs: ${info.nPubInputs}, Private Inputs: ${info.nPrvInputs}`
  );
  if (info.nConstraints >= 8192) {
    throw new Error(`Constraint count ${info.nConstraints} exceeds ptau_13 capacity (8192)!`);
  }

  console.log("[build] Running Groth16 Phase 2 setup...");
  await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkey0Path);

  const entropyHex = crypto.randomBytes(32).toString("hex");
  await snarkjs.zKey.contribute(
    zkey0Path,
    finalZkeyPath,
    "Qlo Phase 2 Ceremony",
    entropyHex
  );
  if (fs.existsSync(zkey0Path)) fs.unlinkSync(zkey0Path);

  console.log("[build] Exporting verification_key.json...");
  const vKey = await snarkjs.zKey.exportVerificationKey(finalZkeyPath);
  fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));

  console.log("[build] Exporting contracts/src/Groth16Verifier.sol...");
  const snarkjsEntry = require.resolve("snarkjs");
  const cliCjs = path.join(path.dirname(snarkjsEntry), "cli.cjs");
  execFileSync(
    process.execPath,
    [cliCjs, "zkey", "export", "solidityverifier", finalZkeyPath, verifierOutPath],
    { cwd: circuitsDir, stdio: "inherit" }
  );

  let solSource = fs.readFileSync(verifierOutPath, "utf8");
  solSource = solSource.replace(
    /pragma solidity\s+[^;]+;/,
    "pragma solidity ^0.8.28;"
  );
  fs.writeFileSync(verifierOutPath, solSource);

  if (!solSource.includes("uint[8] calldata _pubSignals") && !solSource.includes("uint256[8] calldata _pubSignals")) {
    throw new Error("Unexpected Groth16Verifier public signal length (expected 8)");
  }

  console.log("[build] Copying browser ZK assets to apps/web/public/zk/...");
  const webWasmPath = path.join(webZkDir, "ClaimValidity.wasm");
  const webZkeyPath = path.join(webZkDir, "ClaimValidity.zkey");
  const webVkeyPath = path.join(webZkDir, "verification_key.json");
  const webManifestPath = path.join(webZkDir, "manifest.json");

  fs.copyFileSync(wasmPath, webWasmPath);
  fs.copyFileSync(finalZkeyPath, webZkeyPath);
  fs.copyFileSync(vkeyPath, webVkeyPath);

  const manifest = {
    circuitName: "ClaimValidity",
    depth: 6,
    publicSignalsCount: 8,
    nConstraints: info.nConstraints,
    nWires: info.nVars,
    ptauFile: "ppot_0080_13.ptau",
    ptauCapacity: 8192,
    zkeySha256: sha256File(webZkeyPath),
    wasmSha256: sha256File(webWasmPath),
    vkeySha256: sha256File(webVkeyPath),
    zkeyBytes: fs.statSync(webZkeyPath).size,
    wasmBytes: fs.statSync(webWasmPath).size,
    builtAt: new Date().toISOString(),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(webManifestPath, JSON.stringify(manifest, null, 2));

  console.log("[build] Manifest pinned:", JSON.stringify(manifest, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
