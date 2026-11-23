import { NextResponse } from "next/server";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { getRelayStore } from "@/lib/relayStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { vaultBundles } = getRelayStore();
  return NextResponse.json(
    {
      ok: true,
      service: "qlo-clearinghouse",
      chainId: DEPLOYMENT.chainId,
      network: DEPLOYMENT.network,
      deployed: IS_CHAIN_DEPLOYED,
      zkeySha256: DEPLOYMENT.zkeySha256,
      relayVaultCount: vaultBundles.size,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
