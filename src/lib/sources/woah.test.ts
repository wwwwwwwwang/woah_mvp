import { describe, expect, it } from "vitest";

import { parseWoahReportPdf } from "@/lib/sources/woah";

const samplePdfText = `
Nepal - High pathogenicity avian influenza viruses (Inf. with) (poultry) - Immediate notification
EPIDEMIOLOGY
EPIDEMIOLOGICAL COMMENTS
Frequent sightings of wild birds were reported in the vicinity of the farm. Since that incident, mortality has been observed
across all sheds on the farm.
QUANTITATIVE DATA SUMMARY
Species Susceptible Cases Deaths Killed and Disposed of
NEW 23850 5850 5850 18000 0 0 birds (domestic)
TOTAL 23850 5850 5850 18000 0 0
NEW OUTBREAKS
OB_184546 - KOSHI PROVINCE, MORANG, URLABARI MUNICIPALITY-8 ATHIYABARI
AFFECTED POPULATION DESCRIPTION
Commercial Layers of various age groups affected since 15 March 2026.
`;

describe("parseWoahReportPdf", () => {
  it("extracts summary, counts, host species and outbreak location", () => {
    const parsed = parseWoahReportPdf(samplePdfText, {
      reportId: 181798,
      createdBy: "WAHIS",
      eventId: 7386,
      country: "Nepal",
      disease: "High pathogenicity avian influenza viruses (Inf. with) (poultry)",
      subType: "H5N1",
      eventStartDate: "2026-03-15T00:00:00.000+00:00",
      eventStatus: "On-going",
      reason: "Recurrence of an eradicated strain",
      reportType: "IN",
      reportStatus: "Validated",
      submissionDate: "2026-03-21T14:04:05.793+00:00",
      reportNumber: 0,
      isAquatic: false,
      isLastReportUnchanged: false,
    });

    expect(parsed.summary).toContain("wild birds");
    expect(parsed.caseCount).toBe(5850);
    expect(parsed.deathCount).toBe(5850);
    expect(parsed.hostSpecies).toBe("poultry");
    expect(parsed.rawLocation).toContain("KOSHI PROVINCE");
  });
});
