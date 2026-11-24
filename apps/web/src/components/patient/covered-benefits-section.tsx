"use client";

import { Badge } from "@/components/ui/card";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { COVERED_CLINICAL_SCHEDULE } from "@/lib/clinicalCatalog";

export function CoveredBenefitsSection() {
  return (
    <section id="patient-benefits" className="space-y-3 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#09090B]">
            Covered Clinical Benefits Schedule
          </h3>
          <p className="text-xs text-[#52525B]">
            Pre-committed in the Poseidon Depth-6 benefit Merkle tree for private ZK coverage verification.
          </p>
        </div>
        <Badge variant="emerald">{COVERED_CLINICAL_SCHEDULE.length} Approved CPT Codes</Badge>
      </div>

      <SmoothAccordion
        defaultOpen={["cat-Emergency"]}
        items={[
          {
            id: "cat-Emergency",
            title: "Emergency & Acute Cardiac Care",
            subtitle: "Priority high-severity & urgent ED stabilization",
            badge: "CPT 99285 · 99284",
            content: (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {COVERED_CLINICAL_SCHEDULE.filter((c) => c.category === "Emergency").map((item) => (
                  <div
                    key={item.code}
                    className="rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#09090B]">{item.title}</span>
                      <span className="font-mono-tabular text-[11px] font-semibold text-[#059669]">
                        CPT {item.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#52525B]">{item.summary}</p>
                    <div className="text-[10px] font-mono-tabular text-[#0284C7]">
                      {item.copayTier} · {item.typicalTurnaround}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "cat-Specialty",
            title: "Outpatient Consultations, Cardiology & Orthopedic Care",
            subtitle: "Follow-up specialist clinics, 12-lead ECG, and closed fracture reduction",
            badge: "CPT 99214 · 93000 · 27750",
            content: (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COVERED_CLINICAL_SCHEDULE.filter((c) =>
                  ["Outpatient", "Cardiology", "Orthopedic"].includes(c.category)
                ).map((item) => (
                  <div
                    key={item.code}
                    className="rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#09090B]">{item.title}</span>
                      <span className="font-mono-tabular text-[11px] font-semibold text-[#059669]">
                        CPT {item.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#52525B]">{item.summary}</p>
                    <div className="text-[10px] font-mono-tabular text-[#0284C7]">
                      {item.copayTier} · {item.typicalTurnaround}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "cat-Diagnostics",
            title: "Diagnostic Radiology & Clinical Pathology Panels",
            subtitle: "Chest imaging, metabolic chemistry panels, and specimen draws",
            badge: "CPT 71046 · 80053 · 36415",
            content: (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COVERED_CLINICAL_SCHEDULE.filter((c) =>
                  ["Radiology", "Pathology"].includes(c.category)
                ).map((item) => (
                  <div
                    key={item.code}
                    className="rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#09090B]">{item.title}</span>
                      <span className="font-mono-tabular text-[11px] font-semibold text-[#059669]">
                        CPT {item.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#52525B]">{item.summary}</p>
                    <div className="text-[10px] font-mono-tabular text-[#0284C7]">
                      {item.copayTier} · {item.typicalTurnaround}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
