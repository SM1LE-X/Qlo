import { after, NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  openActionPayload,
  openModal,
  postMessage,
  publishAppHome,
  resolveRoleChannel,
  sealActionPayload,
  updateMessage,
} from "@/lib/slack/api";
import type { SlackRole } from "@/lib/slack/blocks";
import {
  findProviderName,
  findVisitPreset,
  proveAndSettleClaim,
  readLiveChainSummary,
  revokeRecordAccess,
  sealAndGrantBill,
} from "@/lib/slack/serverEngine";
import { getSlackUserRole, setSlackUserRole } from "@/lib/slack/userRoles";
import { verifySlackSignature } from "@/lib/slack/verifySignature";
import {
  buildAppHomeView,
  buildAuditProofModal,
  buildHospitalClaimCard,
  buildInsurerDisbursementCard,
  buildPatientReceiptCard,
  buildSubmitBillModal,
  SLACK_ACTIONS,
  SLACK_CALLBACKS,
} from "@/lib/slack/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

interface SealedClaimState {
  recordId: number;
  recordLabel: string;
  recordCommitmentHex: Hex;
  providerName: string;
  categoryLabel: string;
  cptCode: number;
  amountEth: string;
  onChain: boolean;
  patientChannel?: string;
  patientTs?: string;
  hospitalChannel?: string;
  hospitalTs?: string;
  nullifier?: string;
  proofElapsedMs?: number;
  txHash?: string;
  explorerUrl?: string;
  status?: string;
}

interface SlackInteractionPayload {
  type?: string;
  trigger_id?: string;
  response_url?: string;
  user?: { id?: string };
  channel?: { id?: string };
  message?: { ts?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: {
      values?: Record<
        string,
        Record<string, { value?: string; selected_option?: { value?: string } }>
      >;
    };
  };
}

async function respondEphemeral(responseUrl: string | undefined, text: string) {
  if (!responseUrl) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, "slack-interact", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const secret = (process.env.SLACK_SIGNING_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json(
      { error: "SLACK_NOT_CONFIGURED" },
      { status: 503, headers: NO_STORE }
    );
  }

  const rawBody = await request.text();
  const valid = verifySlackSignature({
    signingSecret: secret,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    rawBody,
  });
  if (!valid) {
    return NextResponse.json({ error: "INVALID_SLACK_SIGNATURE" }, { status: 401, headers: NO_STORE });
  }

  const form = new URLSearchParams(rawBody);
  const payloadRaw = form.get("payload");
  if (!payloadRaw) {
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  let payload: SlackInteractionPayload;
  try {
    payload = JSON.parse(payloadRaw) as SlackInteractionPayload;
  } catch {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400, headers: NO_STORE });
  }

  const userId = payload.user?.id ?? "";
  const triggerId = payload.trigger_id ?? "";

  // 1. Native Modal Submission: Submit Medical Bill
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === SLACK_CALLBACKS.SUBMIT_BILL
  ) {
    const vals = payload.view.state?.values ?? {};
    const visitId = vals.visit_block?.visit_select?.selected_option?.value ?? "cardiac_er";
    const providerId = vals.provider_block?.provider_select?.selected_option?.value ?? "metro_cardiac";
    const durationSec = Number(vals.duration_block?.duration_select?.selected_option?.value ?? "600");
    const notes = vals.notes_block?.notes_input?.value ?? "";

    const visit = findVisitPreset(visitId);
    const providerName = findProviderName(providerId);

    after(async () => {
      const sealed = await sealAndGrantBill({
        visit,
        providerName,
        durationSec: Number.isFinite(durationSec) && durationSec >= 60 ? durationSec : 600,
        notes,
      });

      const recordLabel = `Record #${sealed.recordId}`;
      const baseState: SealedClaimState = {
        recordId: sealed.recordId,
        recordLabel,
        recordCommitmentHex: sealed.recordCommitmentHex,
        providerName,
        categoryLabel: visit.categoryLabel,
        cptCode: visit.cptCode,
        amountEth: visit.amountEth,
        onChain: sealed.onChain,
        status: visit.excluded ? "Rejected (Excluded Policy)" : "Pending Settlement",
      };

      const patientChan = await resolveRoleChannel("patient", userId);
      const hospitalChan = await resolveRoleChannel("hospital", userId);

      // Post to #hospital-claims first so patient revoke token knows both message timestamps
      let hospitalTs: string | undefined;
      if (hospitalChan) {
        if (visit.excluded) {
          const rejCard = buildHospitalClaimCard({
            recordLabel,
            providerName,
            categoryLabel: visit.categoryLabel,
            amountEth: visit.amountEth,
            status: "rejected",
            errorMessage: "Procedure category excluded under active policy. 0 ETH released.",
          });
          const res = await postMessage(hospitalChan, rejCard);
          hospitalTs = res.ts;
        } else {
          const placeholderState: SealedClaimState = { ...baseState, hospitalChannel: hospitalChan };
          const inspectToken = sealActionPayload(placeholderState, secret);
          const settleToken = sealActionPayload(placeholderState, secret);
          const readyCard = buildHospitalClaimCard({
            recordLabel,
            providerName,
            categoryLabel: visit.categoryLabel,
            amountEth: visit.amountEth,
            status: "ready",
            settleToken,
            inspectToken,
          });
          const res = await postMessage(hospitalChan, readyCard);
          hospitalTs = res.ts;
        }
      }

      if (patientChan) {
        const stateWithHospital: SealedClaimState = {
          ...baseState,
          patientChannel: patientChan,
          hospitalChannel: hospitalChan ?? undefined,
          hospitalTs,
        };
        const revokeToken = visit.excluded ? undefined : sealActionPayload(stateWithHospital, secret);
        const receipt = buildPatientReceiptCard({
          recordLabel,
          providerName,
          categoryLabel: visit.categoryLabel,
          amountEth: visit.amountEth,
          status: "active",
          revokeToken,
          explorerUrl: sealed.explorerUrl,
        });
        const pRes = await postMessage(patientChan, receipt);

        // Update hospital settle button so settling also updates the patient receipt card!
        if (!visit.excluded && hospitalChan && hospitalTs && pRes.ts) {
          const fullState: SealedClaimState = {
            ...stateWithHospital,
            patientTs: pRes.ts,
          };
          const updatedSettle = sealActionPayload(fullState, secret);
          const updatedInspect = sealActionPayload(fullState, secret);
          await updateMessage(
            hospitalChan,
            hospitalTs,
            buildHospitalClaimCard({
              recordLabel,
              providerName,
              categoryLabel: visit.categoryLabel,
              amountEth: visit.amountEth,
              status: "ready",
              settleToken: updatedSettle,
              inspectToken: updatedInspect,
            })
          );
        }
      }

      if (userId) {
        const summary = await readLiveChainSummary();
        await publishAppHome(userId, buildAppHomeView({ role: getSlackUserRole(userId), summary }));
      }
    });

    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  // 2. Interactive Block Actions
  const action = payload.actions?.[0];
  const actionId = action?.action_id ?? "";
  const channelId = payload.channel?.id ?? "";
  const messageTs = payload.message?.ts ?? "";

  if (actionId === SLACK_ACTIONS.OPEN_SUBMIT && triggerId) {
    await openModal(triggerId, buildSubmitBillModal(channelId));
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  if (
    actionId === SLACK_ACTIONS.ROLE_PATIENT ||
    actionId === SLACK_ACTIONS.ROLE_HOSPITAL ||
    actionId === SLACK_ACTIONS.ROLE_INSURER
  ) {
    const roleMap: Record<string, SlackRole> = {
      [SLACK_ACTIONS.ROLE_PATIENT]: "patient",
      [SLACK_ACTIONS.ROLE_HOSPITAL]: "hospital",
      [SLACK_ACTIONS.ROLE_INSURER]: "insurer",
    };
    const nextRole = roleMap[actionId];
    if (userId && nextRole) {
      setSlackUserRole(userId, nextRole);
      after(async () => {
        const summary = await readLiveChainSummary();
        await publishAppHome(userId, buildAppHomeView({ role: nextRole, summary }));
        await respondEphemeral(
          payload.response_url,
          `Role updated to *${nextRole === "hospital" ? "Provider" : nextRole === "insurer" ? "Insurer" : "Patient"}*. Open the *Qlo Home* tab or run \`/qlo submit\`.`
        );
      });
    }
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  if (actionId === SLACK_ACTIONS.CHECK_STATUS) {
    after(async () => {
      const live = await readLiveChainSummary();
      await respondEphemeral(
        payload.response_url,
        `*Qlo Status*\nEscrow Balance: *${live.escrowEth} ETH* · Settled: *${live.settledCount}* · Policy Used: *${live.policySpentEth} / 0.0300 ETH*`
      );
    });
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  if (actionId === SLACK_ACTIONS.INSPECT_PROOF && action?.value && triggerId) {
    const state = openActionPayload<SealedClaimState>(action.value, secret);
    if (state) {
      await openModal(
        triggerId,
        buildAuditProofModal({
          recordLabel: state.recordLabel,
          providerName: state.providerName,
          amountEth: state.amountEth,
          recordCommitmentHex: state.recordCommitmentHex,
          nullifier: state.nullifier,
          proofElapsedMs: state.proofElapsedMs,
          txHash: state.txHash,
          explorerUrl: state.explorerUrl,
          status: state.status ?? "Verified",
        })
      );
    }
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  if (actionId === SLACK_ACTIONS.REVOKE_ACCESS && action?.value) {
    const state = openActionPayload<SealedClaimState>(action.value, secret);
    if (state) {
      after(async () => {
        const revoked = await revokeRecordAccess({
          recordId: state.recordId,
          onChain: state.onChain,
        });

        const pChan = state.patientChannel ?? channelId;
        const pTs = state.patientTs ?? messageTs;
        if (pChan && pTs) {
          await updateMessage(
            pChan,
            pTs,
            buildPatientReceiptCard({
              recordLabel: state.recordLabel,
              providerName: state.providerName,
              categoryLabel: state.categoryLabel,
              amountEth: state.amountEth,
              status: "revoked",
              explorerUrl: revoked.explorerUrl,
            })
          );
        }

        if (state.hospitalChannel && state.hospitalTs) {
          await updateMessage(
            state.hospitalChannel,
            state.hospitalTs,
            buildHospitalClaimCard({
              recordLabel: state.recordLabel,
              providerName: state.providerName,
              categoryLabel: state.categoryLabel,
              amountEth: state.amountEth,
              status: "revoked",
              errorMessage: "Patient revoked access. Claim settlement blocked.",
            })
          );
        }
      });
    }
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  if (actionId === SLACK_ACTIONS.APPROVE_SETTLE && action?.value) {
    const state = openActionPayload<SealedClaimState>(action.value, secret);
    if (state && channelId && messageTs) {
      after(async () => {
        await updateMessage(
          channelId,
          messageTs,
          buildHospitalClaimCard({
            recordLabel: state.recordLabel,
            providerName: state.providerName,
            categoryLabel: state.categoryLabel,
            amountEth: state.amountEth,
            status: "settling",
          })
        );

        const result = await proveAndSettleClaim({
          cptCode: state.cptCode,
          amountEth: state.amountEth,
          recordCommitmentHex: state.recordCommitmentHex,
          onChainRecord: state.onChain,
        });

        if (!result.ok) {
          await updateMessage(
            channelId,
            messageTs,
            buildHospitalClaimCard({
              recordLabel: state.recordLabel,
              providerName: state.providerName,
              categoryLabel: state.categoryLabel,
              amountEth: state.amountEth,
              status: result.code === "ACCESS_REVOKED" ? "revoked" : "rejected",
              errorMessage: result.reason ?? "Settlement rejected.",
            })
          );
          return;
        }

        const settledState: SealedClaimState = {
          ...state,
          nullifier: result.nullifier,
          proofElapsedMs: result.proofElapsedMs,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          status: result.onChain ? "Settled on Ethereum Sepolia" : "Verified (Groth16 BN254)",
        };
        const inspectToken = sealActionPayload(settledState, secret);

        await updateMessage(
          channelId,
          messageTs,
          buildHospitalClaimCard({
            recordLabel: state.recordLabel,
            providerName: state.providerName,
            categoryLabel: state.categoryLabel,
            amountEth: state.amountEth,
            status: "settled",
            inspectToken,
            txHash: result.txHash,
            explorerUrl: result.explorerUrl,
          })
        );

        if (state.patientChannel && state.patientTs) {
          await updateMessage(
            state.patientChannel,
            state.patientTs,
            buildPatientReceiptCard({
              recordLabel: state.recordLabel,
              providerName: state.providerName,
              categoryLabel: state.categoryLabel,
              amountEth: state.amountEth,
              status: "settled",
              explorerUrl: result.explorerUrl,
            })
          );
        }

        const insurerChan = await resolveRoleChannel("insurer", userId);
        if (insurerChan) {
          await postMessage(
            insurerChan,
            buildInsurerDisbursementCard({
              recordLabel: state.recordLabel,
              providerName: state.providerName,
              amountEth: state.amountEth,
              txHash: result.txHash,
              explorerUrl: result.explorerUrl,
              inspectToken,
            })
          );
        }

        if (userId) {
          const summary = await readLiveChainSummary();
          await publishAppHome(userId, buildAppHomeView({ role: getSlackUserRole(userId), summary }));
        }
      });
    }
    return NextResponse.json({}, { status: 200, headers: NO_STORE });
  }

  return NextResponse.json({}, { status: 200, headers: NO_STORE });
}
