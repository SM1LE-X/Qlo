import type { NextRequest } from "next/server";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

const MAX_TRACKED_KEYS = 2000;

declare global {
  var __qloRateLimiter: Map<string, number[]> | undefined;
}

function getLimiterMap(): Map<string, number[]> {
  if (!globalThis.__qloRateLimiter) {
    globalThis.__qloRateLimiter = new Map<string, number[]>();
  }
  return globalThis.__qloRateLimiter;
}

function extractClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}

/**
 * In-memory sliding-window rate limiter per client IP + bucket for Zero-PHI relay endpoints.
 */
export function checkRateLimit(
  request: NextRequest,
  bucket: string,
  maxRequests: number,
  windowMs = 60_000
): RateLimitResult {
  const store = getLimiterMap();
  const ip = extractClientIp(request);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!store.has(key) && store.size >= MAX_TRACKED_KEYS) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }

  const hits = (store.get(key) ?? []).filter((ts) => ts > windowStart);
  if (hits.length >= maxRequests) {
    const oldest = hits[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    store.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  const updated = [...hits, now];
  store.set(key, updated);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - updated.length),
    retryAfterSec: 0,
  };
}
