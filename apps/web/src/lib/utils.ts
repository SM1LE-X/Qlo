import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortHex(hex: string, start = 6, end = 4): string {
  if (!hex || hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start)}...${hex.slice(-end)}`;
}

export function formatWeiToEth(wei: bigint | string | number, decimals = 4): string {
  const value = BigInt(wei);
  const whole = value / 10n ** 18n;
  const frac = value % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  return `${whole.toString()}.${fracStr}`;
}

export function parseEthToWei(ethStr: string): bigint {
  const trimmed = ethStr.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid ETH amount: ${ethStr}`);
  }
  const [wholePart, fracPart = ""] = trimmed.split(".");
  const paddedFrac = fracPart.slice(0, 18).padEnd(18, "0");
  return BigInt(wholePart) * 10n ** 18n + BigInt(paddedFrac);
}

export function formatCountdown(secondsLeft: number): { mins: number; secs: number } {
  const clamped = Math.max(0, Math.floor(secondsLeft));
  return {
    mins: Math.floor(clamped / 60),
    secs: clamped % 60,
  };
}
