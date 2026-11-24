import {
  accessCard,
  intakeCard,
  proofReadyCard,
  rejectCard,
  revokedCard,
  settledCard,
  type SlackBlockMessage,
  type SlackRole,
} from "@/lib/slack/blocks";

export interface StoryBeat {
  id: string;
  channel: SlackRole;
  delayMs: number;
  message: SlackBlockMessage;
}

const HOSPITAL = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const COMMITMENT = "0x009f2a41c7d8e03b5a66f1c2d4e8a7b3905c1d2e4f8812aa34bc56de78f01234";
const NULLIFIER = "0x2b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfe";
const TX = "0xa1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef";

export const STORY_BEATS: ReadonlyArray<StoryBeat> = [
  {
    id: "intake",
    channel: "patient",
    delayMs: 900,
    message: intakeCard({ commitmentHex: COMMITMENT, categoryLabel: "Emergency cardiac visit", amountEth: "0.0100" }),
  },
  {
    id: "access",
    channel: "patient",
    delayMs: 1300,
    message: accessCard({
      recordLabel: "Record #1",
      hospitalAddress: HOSPITAL,
      expiresAtIso: "2026-12-31T00:00:00Z",
      revokeUrl: "/patient",
    }),
  },
  {
    id: "proof",
    channel: "hospital",
    delayMs: 1400,
    message: proofReadyCard({
      claimLabel: "Claim #1",
      amountEth: "0.0100",
      hospitalAddress: HOSPITAL,
      settleUrl: "/hospital",
      inspectUrl: "/insurer",
    }),
  },
  {
    id: "settled",
    channel: "insurer",
    delayMs: 1400,
    message: settledCard({
      txHash: TX,
      amountEth: "0.0100",
      nullifier: NULLIFIER,
      explorerUrl: "https://sepolia.etherscan.io/tx/" + TX,
    }),
  },
  {
    id: "cosmetic",
    channel: "hospital",
    delayMs: 1300,
    message: rejectCard({ reason: "Procedure category excluded by policy", code: "POLICY_EXCLUDED" }),
  },
  {
    id: "replay",
    channel: "insurer",
    delayMs: 1300,
    message: rejectCard({ reason: "Nullifier already spent on-chain", code: "NULLIFIER_ALREADY_USED" }),
  },
  {
    id: "revoke",
    channel: "patient",
    delayMs: 1300,
    message: revokedCard({ recordLabel: "Record #1", hospitalAddress: HOSPITAL }),
  },
];
