import type { PathogenCatalogEntry, PathogenCode } from "@/lib/types";

export const PATHOGEN_CATALOG: PathogenCatalogEntry[] = [
  {
    code: "NIPAH",
    chineseName: "尼帕病毒性脑炎",
    englishName: "Nipah virus",
    aliases: ["Nipah", "Nipah virus infection", "Henipavirus nipahense", "尼帕病毒", "尼帕病毒病"],
    queryTerms: {
      ncbi: '"Henipavirus nipahense"[Organism]',
      who: ["Nipah virus", "Nipah virus disease", "Nipah virus infection"],
      woah: ["nipah virus", "nipah virus infection", "nipah"],
      chinacdc: ["尼帕病毒", "尼帕病毒病", "Nipah"],
    },
  },
  {
    code: "H5N1",
    chineseName: "高致病性禽流感(H5N1)",
    englishName: "Highly pathogenic avian influenza H5N1",
    aliases: ["HPAI", "H5N1", "avian influenza", "high pathogenicity avian influenza", "禽流感", "甲型H5N1"],
    queryTerms: {
      ncbi: '("Influenza A virus"[Organism]) AND H5N1[All Fields]',
      who: ["H5N1", "avian influenza", "human infection with avian influenza"],
      woah: ["H5N1", "high pathogenicity avian influenza", "avian influenza"],
      chinacdc: ["H5N1", "禽流感", "高致病性禽流感", "人感染动物源性流感"],
    },
  },
  {
    code: "RVF",
    chineseName: "裂谷热",
    englishName: "Rift Valley fever virus",
    aliases: ["Rift Valley fever", "Rift Valley fever virus", "RVF", "裂谷热"],
    queryTerms: {
      ncbi: '"Rift Valley fever phlebovirus"[Organism]',
      who: ["Rift Valley fever", "RVF"],
      woah: ["Rift Valley fever", "RVF"],
      chinacdc: ["裂谷热", "Rift Valley fever", "RVF"],
    },
  },
  {
    code: "XHFV",
    chineseName: "新疆出血热",
    englishName: "Xinjiang hemorrhagic fever virus",
    aliases: [
      "Xinjiang hemorrhagic fever virus",
      "Xinjiang hemorrhagic fever",
      "Crimean-Congo hemorrhagic fever",
      "Crimean-Congo haemorrhagic fever",
      "XHFV",
      "新疆出血热",
      "克里米亚-刚果出血热",
    ],
    queryTerms: {
      ncbi: '"Xinjiang hemorrhagic fever virus"[All Fields]',
      who: ["Xinjiang hemorrhagic fever", "Crimean-Congo haemorrhagic fever", "Crimean-Congo hemorrhagic fever"],
      woah: ["Crimean-Congo haemorrhagic fever", "Xinjiang hemorrhagic fever", "CCHF"],
      chinacdc: ["新疆出血热", "克里米亚-刚果出血热", "Crimean-Congo", "XHFV"],
    },
  },
];

export const PATHOGEN_MAP = new Map<PathogenCode, PathogenCatalogEntry>(
  PATHOGEN_CATALOG.map((entry) => [entry.code, entry]),
);

export function getPathogenCatalogEntry(code: PathogenCode) {
  const entry = PATHOGEN_MAP.get(code);
  if (!entry) {
    throw new Error(`Unsupported pathogen code: ${code}`);
  }

  return entry;
}
