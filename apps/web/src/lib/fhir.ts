import type { RelaySettledClaim } from "@/lib/relayStore";
import { weiToEth } from "@/lib/slack/commands";

/**
 * Builds a pseudonymous HL7 FHIR R4 ClaimResponse for a settled claim.
 * The patient is referenced only by an on-chain record commitment.
 */
export function buildClaimResponse(claim: RelaySettledClaim): Record<string, unknown> {
  return {
    resourceType: "ClaimResponse",
    id: claim.txHash.slice(2, 18),
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: "institutional",
        },
      ],
    },
    use: "claim",
    patient: {
      identifier: {
        system: "urn:qlo:record-commitment",
        value: claim.recordCommitmentHex,
      },
    },
    created: new Date(claim.settledAt * 1000).toISOString(),
    insurer: { display: "Qlo ClaimsVault escrow (Ethereum Sepolia)" },
    outcome: "complete",
    disposition: "Settled via zero-knowledge proof; no PHI disclosed",
    payment: {
      amount: { value: Number(weiToEth(claim.amountWei, 6)), currency: "ETH" },
    },
    extension: [
      { url: "urn:qlo:settlement-tx", valueString: claim.txHash },
      { url: "urn:qlo:nullifier", valueString: claim.nullifier },
      { url: "urn:qlo:phi-exposed", valueBoolean: false },
    ],
  };
}
