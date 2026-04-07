import { describe, expect, it } from "vitest";

import { parseGenBankRecords } from "@/lib/sources/ncbi";

const sampleGenBank = `LOCUS       PX984254                1599 bp    cRNA    linear   VRL 08-MAR-2026
DEFINITION  Henipavirus nipahense strain NiV/Bat/BGD/BNV0370/2022 nucleoprotein
            gene, complete cds.
ACCESSION   PX984254
FEATURES             Location/Qualifiers
     source          1..1599
                     /organism="Henipavirus nipahense"
                     /mol_type="viral cRNA"
                     /strain="NiV/Bat/BGD/BNV0370/2022"
                     /host="Pteropus sp."
                     /db_xref="taxon:3052225"
                     /geo_loc_name="Bangladesh"
                     /collection_date="19-Jun-2022"
//
`;

describe("parseGenBankRecords", () => {
  it("extracts accession, year, location and host", () => {
    const records = parseGenBankRecords(sampleGenBank);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      accession: "PX984254",
      collectionYear: 2022,
      country: "Bangladesh",
      host: "Pteropus sp.",
      strainOrSubtype: "NiV/Bat/BGD/BNV0370/2022",
      sourceDetailUrl: "https://www.ncbi.nlm.nih.gov/nuccore/PX984254",
    });
  });
});
