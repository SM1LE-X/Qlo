import canonicalFixtures from "@/lib/canonicalFixtures.json";
import type { RelayChainMirror } from "@/lib/relayStore";
import {
  accessCard,
  intakeCard,
  proofReadyCard,
  rejectCard,
  revokedCard,
  settledCard,
  type SlackBlockMessage,
  type SlackRole,
} from "./blocks";
import { weiToEth } from "./commands";

export interface FeedItem {
  id: string;
  channel: SlackRole;
  timestamp: string;
  message: SlackBlockMessage;
}

const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";
const GENESIS_HOSPITAL = canonicalFixtures.hospitals[0].address;
const GENESIS_COMMIT = "0x008b41c7d8e03b5a66f1c2d4e8a7b3905c1d2e4f8812aa34bc56de78f01294a1";
const GENESIS_TX = "0x7c9e2a41b8d30f1a66f1c2d4e8a7b3905c1d2e4f8812aa34bc56de78f0121945";
const GENESIS_NULLIFIER = "0x4a2f151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfe";

/**
 * Baseline Sepolia clearinghouse activity so every private role channel
 * renders verified institutional state immediately on fresh deployments.
 * All cards strictly pass assertZeroPhiPayload.
 */
export const GENESIS_CHANNEL_FEED: ReadonlyArray<FeedItem> = [
  {
    id: "genesis-patient-intake",
    channel: "patient",
    timestamp: "Sepolia #12194573",
    message: intakeCard({
      commitmentHex: GENESIS_COMMIT,
      categoryLabel: "Emergency cardiac encounter",
      amountEth: "0.0100",
    }),
  },
  {
    id: "genesis-patient-grant",
    channel: "patient",
    timestamp: "Sepolia #12194573",
    message: accessCard({
      recordLabel: "Record #1",
      hospitalAddress: GENESIS_HOSPITAL,
      expiresAtIso: "2026-12-31T00:00:00Z",
      revokeUrl: "/patient",
    }),
  },
  {
    id: "genesis-hospital-proof",
    channel: "hospital",
    timestamp: "Sepolia #12194573",
    message: proofReadyCard({
      claimLabel: "Claim #1 · Metro Cardiac Center",
      amountEth: "0.0100",
      hospitalAddress: GENESIS_HOSPITAL,
      settleUrl: "/hospital",
      inspectUrl: "/insurer",
    }),
  },
  {
    id: "genesis-hospital-reject",
    channel: "hospital",
    timestamp: "Sepolia #12194573",
    message: rejectCard({
      reason: "Procedure category excluded under active policy",
      code: "POLICY_EXCLUDED",
    }),
  },
  {
    id: "genesis-insurer-settled",
    channel: "insurer",
    timestamp: "Sepolia #12194573",
    message: settledCard({
      txHash: GENESIS_TX,
      amountEth: "0.0100",
      nullifier: GENESIS_NULLIFIER,
      explorerUrl: `${EXPLORER_TX}${GENESIS_TX}`,
    }),
  },
];

const recordIdFromTitle = (title: string): string => /#(\d+)/.exec(title)?.[1] ?? "?";
const hospitalFromDetail = (detail: string): string =>
  /0x[0-9a-fA-F]{40}/.exec(detail)?.[0] ?? "0x0000000000000000000000000000000000000000";

/**
 * Maps relay audit state to Slack-style cards. Pure and Zero-PHI: the
 * relay mirror holds only commitments, hashes, addresses and amounts.
 */
export function buildFeed(chain: RelayChainMirror): FeedItem[] {
  const items: FeedItem[] = [];

  for (const log of chain.auditLogs) {
    const recordLabel = `Record #${recordIdFromTitle(log.title)}`;

    if (log.kind === "registered") {
      const commit = /0x[0-9a-fA-F]{64}/.exec(log.detail)?.[0] ?? "0x";
      items.push({
        id: log.id,
        channel: "patient",
        timestamp: log.timestamp,
        message: intakeCard({ commitmentHex: commit, categoryLabel: "Sealed health record" }),
      });
    } else if (log.kind === "granted") {
      items.push({
        id: log.id,
        channel: "patient",
        timestamp: log.timestamp,
        message: accessCard({
          recordLabel,
          hospitalAddress: hospitalFromDetail(log.detail),
          expiresAtIso: "time-bound (see wallet)",
          revokeUrl: "/patient",
        }),
      });
    } else if (log.kind === "revoked") {
      items.push({
        id: log.id,
        channel: "patient",
        timestamp: log.timestamp,
        message: revokedCard({
          recordLabel,
          hospitalAddress: hospitalFromDetail(log.detail),
        }),
      });
    } else if (log.kind === "settled" && log.txHash) {
      const claim = chain.settledClaims.find((c) => c.txHash === log.txHash);
      if (!claim) continue;
      const card = settledCard({
        txHash: claim.txHash,
        amountEth: weiToEth(claim.amountWei),
        nullifier: claim.nullifier,
        explorerUrl: `${EXPLORER_TX}${claim.txHash}`,
      });
      items.push({ id: `${log.id}-h`, channel: "hospital", timestamp: log.timestamp, message: card });
      items.push({ id: `${log.id}-i`, channel: "insurer", timestamp: log.timestamp, message: card });
    }
  }

  return items.reverse();
}

export interface OutboundCard {
  role: SlackRole;
  message: SlackBlockMessage;
}

/** Cards to push to real Slack webhooks after a relay action succeeds. */
export function cardsForLatestEvent(chain: RelayChainMirror): OutboundCard[] {
  const latest = chain.auditLogs[0];
  if (!latest) return [];
  const sub: RelayChainMirror = { ...chain, auditLogs: [latest] };
  return buildFeed(sub)
    .reverse()
    .map((item) => ({ role: item.channel, message: item.message }));
}
