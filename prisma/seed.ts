import "dotenv/config";

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

import { PATHOGEN_CATALOG } from "../src/lib/constants/pathogens";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

async function main() {
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
