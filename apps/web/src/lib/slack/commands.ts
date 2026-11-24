import type { RelayChainMirror } from "@/lib/relayStore";
import { digestCard, type SlackBlockMessage } from "./blocks";

const WEI_PER_ETH = 1_000_000_000_000_000_000n;

export function weiToEth(wei: string, decimals = 4): string {
  try {
    const value = BigInt(wei);
    const whole = value / WEI_PER_ETH;
    const frac = (value % WEI_PER_ETH).toString().padStart(18, "0").slice(0, decimals);
    return `${whole}.${frac}`;
  } catch {
    return "0.0000";
  }
}

export interface ParsedCommand {
  name: "status" | "claims" | "audit" | "help" | "unknown";
  arg: string;
}

export function parseCommand(text: string): ParsedCommand {
  const cleaned = text.trim().replace(/^\/qlo\b\s*/i, "");
  const [first = "", ...rest] = cleaned.split(/\s+/);
  const name = first.toLowerCase();
  const arg = rest.join(" ");
  if (name === "status" || name === "claims" || name === "audit" || name === "help") {
    return { name, arg };
  }
  return { name: "unknown", arg: cleaned };
}

const plain = (text: string): SlackBlockMessage => ({
  text,
  blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
});

export function runCommand(text: string, chain: RelayChainMirror): SlackBlockMessage {
  const cmd = parseCommand(text);

  switch (cmd.name) {
    case "status":
      return plain(
        `*Qlo status*\nEscrow: ${weiToEth(chain.insurerEscrowWei)} ETH\nRecords: ${chain.records.length}\nSettled claims: ${chain.settledClaims.length}`
      );
    case "claims": {
      const pendingWei = chain.settledClaims.reduce(
        (sum, c) => sum + BigInt(c.amountWei),
        0n
      );
      return digestCard({
        ready: chain.records.length - chain.settledClaims.length,
        rejected: 0,
        pendingEth: weiToEth(pendingWei.toString()),
      });
    }
    case "audit": {
      if (!/^(0x)?[0-9a-fA-F]{8,}$/.test(cmd.arg)) {
        return plain("Usage: `/qlo audit <nullifier hex>`");
      }
      const key = cmd.arg.startsWith("0x") ? cmd.arg : `0x${cmd.arg}`;
      const used = Boolean(chain.nullifierUsed[key] ?? chain.nullifierUsed[cmd.arg]);
      return plain(
        used
          ? "Nullifier *already spent*: a repeat claim would be rejected."
          : "Nullifier *not found*: no claim has used it."
      );
    }
    case "help":
      return plain("Commands: `/qlo status`, `/qlo claims`, `/qlo audit <nullifier>`");
    default:
      return plain("Unknown command. Try `/qlo help`.");
  }
}
