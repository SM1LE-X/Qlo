import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, "../build");
const ptauPath = path.join(buildDir, "ppot_0080_13.ptau");
const PTAU_URLS = [
  "https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_13.ptau",
  "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_13.ptau",
];

fs.mkdirSync(buildDir, { recursive: true });

if (fs.existsSync(ptauPath) && fs.statSync(ptauPath).size > 1_000_000) {
  console.log(`[ptau] Already present (${fs.statSync(ptauPath).size} bytes): ${ptauPath}`);
  process.exit(0);
}

let downloaded = false;
let lastError = null;
for (const url of PTAU_URLS) {
  console.log(`[ptau] Downloading ${url}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_000_000) {
      throw new Error(`Downloaded ptau unexpectedly small: ${buf.length} bytes`);
    }
    fs.writeFileSync(ptauPath, buf);
    console.log(`[ptau] Saved ${buf.length} bytes to ${ptauPath}`);
    downloaded = true;
    break;
  } catch (err) {
    lastError = err;
    console.warn(`[ptau] Mirror failed (${url}): ${err.message}`);
  }
}

if (!downloaded) {
  throw lastError ?? new Error("Failed to download ptau from all mirrors");
}
