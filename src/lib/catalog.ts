import { PATHOGEN_CATALOG } from "@/lib/constants/pathogens";
import { prisma } from "@/lib/db";

export async function ensurePathogenCatalog() {
  for (const pathogen of PATHOGEN_CATALOG) {
    await prisma.pathogen.upsert({
      where: { code: pathogen.code },
      update: {
        chineseName: pathogen.chineseName,
        englishName: pathogen.englishName,
        aliases: pathogen.aliases,
        queryTerms: pathogen.queryTerms,
      },
      create: {
        code: pathogen.code,
        chineseName: pathogen.chineseName,
        englishName: pathogen.englishName,
        aliases: pathogen.aliases,
        queryTerms: pathogen.queryTerms,
      },
    });
  }
}
