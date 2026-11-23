"use client";

import { Download, FileCode2 } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
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
    <SpotlightCard id="hospital-standards" accent="neutral" className="p-6 space-y-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] pb-3">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-[#0F4C81]" />
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Healthcare Standards Interoperability (Off-Chain Clearinghouse Staging)
            </h2>
            <p className="text-xs text-[#52525B]">
              Inspect and export standard HL7 FHIR R4 Claim JSON or ANSI X12 837P (005010X222A1) generated locally after DEK unwrap—never exposed on-chain.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1">
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
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-white text-[#09090B] shadow-2xs"
                      : "text-[#71717A] hover:text-[#09090B]"
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
        <pre className="max-h-64 overflow-y-auto rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 font-mono-tabular text-[11px] leading-relaxed text-[#09090B]">
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
        <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-[#FAFAFA] py-6 text-center text-xs text-[#71717A]">
          Unwrap and decrypt an authorized patient record above to stage standard HL7 FHIR R4 or ANSI X12 837P claim artifacts locally.
        </div>
      )}
    </SpotlightCard>
  );
}
