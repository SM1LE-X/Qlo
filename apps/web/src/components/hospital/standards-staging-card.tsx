"use client";

import { Download, FileCode2 } from "lucide-react";
import { TactileButton } from "@/components/ui/tactile-button";
import { getProviderDisplayName } from "@/lib/clinicalCatalog";
import { cms1500ToFhirClaim, cms1500ToX12837P } from "@/lib/healthcareStandards";
import { type Cms1500Claim } from "@/lib/intake";

interface StandardsStagingCardProps {
  standardsTab: "fhir" | "x12";
  onChangeTab: (tab: "fhir" | "x12") => void;
  decryptedClaim: Cms1500Claim | null;
  hospitalAddr: string;
}

export function StandardsStagingCard({
  standardsTab,
  onChangeTab,
  decryptedClaim,
  hospitalAddr,
}: StandardsStagingCardProps) {
  return (
    <div id="hospital-standards" className="space-y-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-[#0284C7]" />
          <div>
            <h3 className="text-sm font-semibold text-[#09090B]">
              HL7 FHIR R4 &amp; ANSI X12 837P Off-Chain Staging
            </h3>
            <p className="text-xs text-[#52525B]">
              Generated strictly in-browser after DEK unwrap — never written to chain.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-0.5">
            {(
              [
                ["fhir", "HL7 FHIR R4"],
                ["x12", "ANSI X12 837P"],
              ] as const
            ).map(([id, label]) => {
              const active = standardsTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeTab(id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-[#F4F4F5] text-[#09090B] border border-[#D4D4D8]"
                      : "text-[#52525B] hover:text-[#09090B] border border-transparent"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {decryptedClaim ? (
            <TactileButton
              size="sm"
              variant="secondary"
              onClick={() => {
                const content =
                  standardsTab === "fhir"
                    ? JSON.stringify(
                        cms1500ToFhirClaim(
                          decryptedClaim,
                          getProviderDisplayName(hospitalAddr)
                        ),
                        null,
                        2
                      )
                    : cms1500ToX12837P(
                        decryptedClaim,
                        getProviderDisplayName(hospitalAddr),
                        hospitalAddr
                      );
                const blob = new Blob([content], {
                  type: standardsTab === "fhir" ? "application/json" : "text/plain",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download =
                  standardsTab === "fhir"
                    ? `qlo-fhir-claim-${decryptedClaim.cptCode}.json`
                    : `qlo-x12-837p-${decryptedClaim.cptCode}.edi`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export {standardsTab === "fhir" ? "FHIR Claim" : "X12 837P"}
            </TactileButton>
          ) : null}
        </div>
      </div>

      {decryptedClaim ? (
        <pre className="max-h-64 overflow-y-auto rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-4 font-mono-tabular text-[11px] leading-relaxed text-[#09090B]">
          {standardsTab === "fhir"
            ? JSON.stringify(
                cms1500ToFhirClaim(
                  decryptedClaim,
                  getProviderDisplayName(hospitalAddr)
                ),
                null,
                2
              )
            : cms1500ToX12837P(
                decryptedClaim,
                getProviderDisplayName(hospitalAddr),
                hospitalAddr
              )}
        </pre>
      ) : (
        <div className="rounded-lg border border-dashed border-[#E4E4E7] bg-[#F4F4F5] py-6 text-center text-xs text-[#71717A]">
          Unwrap and decrypt an authorized patient record above to stage HL7 FHIR R4 or ANSI X12 837P payloads locally.
        </div>
      )}
    </div>
  );
}
