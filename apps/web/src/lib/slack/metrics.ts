/**
 * In-process Slack demo analytics. Contains ONLY non-PHI operational data:
 * amounts, proof timings, outcome codes and public tx hashes.
 * Resets on server restart; on-chain counters in LiveChainSummary are the source of truth.
 */
export interface SettlementEvent {
  at: number;
  amountEth: string;
  ok: boolean;
  code?: string;
  proofMs?: number;
  txHash?: string;
  explorerUrl?: string;
}

const MAX_EVENTS = 25;
const events: SettlementEvent[] = [];
const inFlight = new Set<string>();

export function recordSettlement(e: SettlementEvent): void {
  events.unshift(e);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

/** Returns false if this key is already being processed (double-click / duplicate delivery guard). */
export function acquireLock(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function releaseLock(key: string): void {
  inFlight.delete(key);
}

export interface MetricsSnapshot {
  attempts: number;
  settled: number;
  blocked: number;
  blockedByCode: Record<string, number>;
  avgProofMs?: number;
  p95ProofMs?: number;
  totalSettledEth: string;
  recent: SettlementEvent[];
}

export function getMetrics(): MetricsSnapshot {
  const ok = events.filter((e) => e.ok);
  const proofs = ok.map((e) => e.proofMs).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const blockedByCode: Record<string, number> = {};
  for (const e of events) {
    if (!e.ok) blockedByCode[e.code ?? "REJECTED"] = (blockedByCode[e.code ?? "REJECTED"] ?? 0) + 1;
  }
  const total = ok.reduce((sum, e) => sum + Number(e.amountEth || 0), 0);
  return {
    attempts: events.length,
    settled: ok.length,
    blocked: events.length - ok.length,
    blockedByCode,
    avgProofMs: proofs.length ? Math.round(proofs.reduce((a, b) => a + b, 0) / proofs.length) : undefined,
    p95ProofMs: proofs.length ? proofs[Math.min(proofs.length - 1, Math.floor(proofs.length * 0.95))] : undefined,
    totalSettledEth: total.toFixed(4),
    recent: events.slice(0, 5),
  };
}

export function __resetMetricsForTests(): void {
  events.length = 0;
  inFlight.clear();
}
