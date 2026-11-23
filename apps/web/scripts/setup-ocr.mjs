import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "..");
const ocrDir = path.join(webDir, "public", "ocr");

const TRAINEDDATA_URL =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz";

function findPackageRoot(startPath, pkgName) {
  let dir = path.dirname(startPath);
  while (true) {
    const pkgJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
        if (pkg.name === pkgName) return dir;
      } catch {
        // Continue walking upward
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate package root for ${pkgName}`);
    }
    dir = parent;
  }
}

async function main() {
  fs.mkdirSync(ocrDir, { recursive: true });

  const tesseractEntry = require.resolve("tesseract.js", { paths: [webDir] });
  const tesseractDir = findPackageRoot(tesseractEntry, "tesseract.js");

  const tesseractRequire = createRequire(path.join(tesseractDir, "package.json"));
  const coreEntry = tesseractRequire.resolve("tesseract.js-core");
  const coreDir = findPackageRoot(coreEntry, "tesseract.js-core");

  const copies = [
    {
      src: path.join(tesseractDir, "dist", "worker.min.js"),
      dest: path.join(ocrDir, "worker.min.js"),
    },
    {
      src: path.join(coreDir, "tesseract-core-simd-lstm.wasm.js"),
      dest: path.join(ocrDir, "tesseract-core-simd-lstm.wasm.js"),
    },
    {
      src: path.join(coreDir, "tesseract-core-lstm.wasm.js"),
      dest: path.join(ocrDir, "tesseract-core-lstm.wasm.js"),
    },
  ];

  for (const { src, dest } of copies) {
    if (!fs.existsSync(src)) {
      throw new Error(`Missing source Tesseract runtime asset: ${src}`);
    }
    fs.copyFileSync(src, dest);
    const size = fs.statSync(dest).size;
    console.log(`[setup-ocr] Copied ${path.basename(dest)} (${size} bytes)`);
  }

  const trainedDataPath = path.join(ocrDir, "eng.traineddata.gz");
  const existingOk =
    fs.existsSync(trainedDataPath) && fs.statSync(trainedDataPath).size >= 1_000_000;

  if (existingOk) {
    const head = fs.readFileSync(trainedDataPath).subarray(0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) {
      console.log(
        `[setup-ocr] Keeping existing eng.traineddata.gz (${fs.statSync(trainedDataPath).size} bytes)`
      );
      return;
    }
  }

  console.log(`[setup-ocr] Downloading ${TRAINEDDATA_URL}...`);
  const res = await fetch(TRAINEDDATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch eng.traineddata.gz: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000 || buf[0] !== 0x1f || buf[1] !== 0x8b) {
    throw new Error(
      `Invalid eng.traineddata.gz payload (bytes=${buf.length}, magic=${buf[0]?.toString(16)} ${buf[1]?.toString(16)})`
    );
  }
  fs.writeFileSync(trainedDataPath, buf);
  console.log(`[setup-ocr] Saved eng.traineddata.gz (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error("[setup-ocr] FAILED:", err);
  process.exit(1);
});
