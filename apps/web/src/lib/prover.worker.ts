/// <reference lib="webworker" />

interface ProveWorkerRequest {
  id: string;
  input: Record<string, unknown>;
}

self.onmessage = async (event: MessageEvent<ProveWorkerRequest>) => {
  const { id, input } = event.data;
  try {
    self.postMessage({ id, type: "stage", stage: "loading_artifacts" });
    const snarkjs = await import("snarkjs");

    self.postMessage({ id, type: "stage", stage: "computing_witness" });
    const t0 = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "/zk/ClaimValidity.wasm",
      "/zk/ClaimValidity.zkey"
    );

    self.postMessage({ id, type: "stage", stage: "verifying_locally" });
    const vkeyRes = await fetch("/zk/verification_key.json");
    const vkey = await vkeyRes.json();
    const localVerified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    const elapsedMs = Math.round(performance.now() - t0);

    self.postMessage({
      id,
      type: "result",
      proof,
      publicSignals,
      localVerified,
      elapsedMs,
    });
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
