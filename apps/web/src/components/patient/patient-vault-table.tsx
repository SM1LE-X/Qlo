"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import { type StoredVaultEntry } from "@/lib/storage";
import { shortHex } from "@/lib/utils";

interface PatientVaultTableProps {
  vaultItems: StoredVaultEntry[];
  targetHospital: string;
  activeGrantsMap: Record<string, { expiresAt: number }>;
  nowSec: number;
  onDownloadBundle: (entry: StoredVaultEntry) => void;
}

export function PatientVaultTable({
  vaultItems,
  targetHospital,
  activeGrantsMap,
  nowSec,
  onDownloadBundle,
}: PatientVaultTableProps) {
  return (
    <div id="patient-vault" className="space-y-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#09090B]">Encrypted Records Vault</h3>
          <p className="text-xs text-[#52525B]">
            Local IndexedDB (<code className="font-mono-tabular text-[#09090B]">qlo-vault-v1</code>) ciphertext bundles and portable{" "}
            <code className="font-mono-tabular text-[#09090B]">.qlo.json</code> exports.
          </p>
        </div>
        <Badge variant="neutral">{vaultItems.length} records stored</Badge>
      </div>

      {vaultItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E4E7] bg-[#F4F4F5] px-4 py-8 text-center text-xs text-[#52525B] space-y-1">
          <div className="font-medium text-[#09090B]">No encrypted records stored locally</div>
          <p className="text-[#71717A]">
            Encrypt a CMS-1500 bill above to populate your local IndexedDB store and generate a portable{" "}
            <code className="font-mono-tabular text-[#52525B]">.qlo.json</code> bundle.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E4E4E7]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] font-mono-tabular text-[11px] uppercase tracking-wider text-[#71717A]">
                <th className="px-4 py-2.5 font-medium">Record</th>
                <th className="px-4 py-2.5 font-medium">Summary</th>
                <th className="px-4 py-2.5 font-medium">CIDv1</th>
                <th className="px-4 py-2.5 font-medium">Consent Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {vaultItems.map((item) => {
                const hospTarget = (item.hospitalAddress || targetHospital).toLowerCase();
                const recGrant = item.recordId
                  ? activeGrantsMap[`${item.recordId}:${hospTarget}`]
                  : undefined;
                const isActive = Boolean(recGrant && recGrant.expiresAt > nowSec);
                return (
                  <tr key={item.recordCommitmentHex} className="hover:bg-[#F4F4F5] transition-colors">
                    <td className="px-4 py-3 font-mono-tabular font-semibold text-[#09090B]">
                      {item.recordId ? `#${item.recordId}` : "Local"}
                    </td>
                    <td className="px-4 py-3 text-[#09090B]">{item.summaryHint || "Encrypted Bill"}</td>
                    <td className="px-4 py-3 font-mono-tabular text-[#52525B]">
                      {shortHex(item.cid, 12, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isActive ? "emerald" : "neutral"}>
                        {isActive ? "Grant Active" : item.recordId ? "Revoked / Idle" : "Unregistered"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TactileButton
                        size="sm"
                        variant="secondary"
                        onClick={() => onDownloadBundle(item)}
                      >
                        <Download className="h-3 w-3" />
                        Bundle
                      </TactileButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
