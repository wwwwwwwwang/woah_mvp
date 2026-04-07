import { prisma } from "@/lib/db";
import { ensurePathogenCatalog } from "@/lib/catalog";
import type { PathogenCode, SourceSystem } from "@/lib/types";

function toSingleValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export async function getDashboardData() {
  await ensurePathogenCatalog();

  const [
    pathogens,
    latestSyncs,
    sequenceCount,
    outbreakCount,
    humanOutbreakCount,
    animalOutbreakCount,
    recentOutbreaks,
    outbreakCountries,
    outbreakSources,
  ] = await Promise.all([
    prisma.pathogen.findMany({
      orderBy: { chineseName: "asc" },
      include: {
        _count: {
          select: {
            sequences: true,
            outbreaks: true,
          },
        },
      },
    }),
    prisma.syncJob.findMany({
      where: { status: "SUCCESS" },
      take: 6,
      orderBy: { startedAt: "desc" },
      include: { pathogen: true },
    }),
    prisma.sequenceRecord.count(),
    prisma.outbreakEvent.count(),
    prisma.outbreakEvent.count({ where: { scope: "human" } }),
    prisma.outbreakEvent.count({ where: { scope: "animal" } }),
    prisma.outbreakEvent.findMany({
      take: 4,
      orderBy: [{ reportDate: "desc" }, { updatedAt: "desc" }],
      include: { pathogen: true },
    }),
    prisma.outbreakEvent.findMany({
      where: { country: { not: null } },
      distinct: ["country"],
      select: { country: true },
    }),
    prisma.outbreakEvent.findMany({
      distinct: ["sourceSystem"],
      select: { sourceSystem: true },
    }),
  ]);

  const topPathogen = [...pathogens]
    .sort((left, right) => {
      if (right._count.outbreaks !== left._count.outbreaks) {
        return right._count.outbreaks - left._count.outbreaks;
      }

      return right._count.sequences - left._count.sequences;
    })
    .find((pathogen) => pathogen._count.outbreaks > 0 || pathogen._count.sequences > 0);

  return {
    pathogens,
    latestSyncs,
    sequenceCount,
    outbreakCount,
    recentOutbreaks,
    insights: {
      topPathogen: topPathogen ?? null,
      latestOutbreak: recentOutbreaks[0] ?? null,
      outbreakCountryCount: outbreakCountries.length,
      activeSourceCount: outbreakSources.length,
      humanOutbreakCount,
      animalOutbreakCount,
    },
  };
}

export async function listSequences(searchParams: Record<string, string | string[] | undefined>) {
  await ensurePathogenCatalog();

  const pathogen = toSingleValue(searchParams.pathogen) as PathogenCode | undefined;
  const country = toSingleValue(searchParams.country);
  const host = toSingleValue(searchParams.host);
  const year = Number(toSingleValue(searchParams.year) ?? "") || undefined;

  return prisma.sequenceRecord.findMany({
    where: {
      pathogen: pathogen ? { code: pathogen } : undefined,
      country: country || undefined,
      host: host || undefined,
      collectionYear: year,
    },
    include: {
      pathogen: true,
    },
    orderBy: [{ collectionYear: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function getSequenceDetail(id: string) {
  await ensurePathogenCatalog();

  return prisma.sequenceRecord.findUnique({
    where: { id },
    include: { pathogen: true },
  });
}

export async function listOutbreaks(searchParams: Record<string, string | string[] | undefined>) {
  await ensurePathogenCatalog();

  const pathogen = toSingleValue(searchParams.pathogen) as PathogenCode | undefined;
  const country = toSingleValue(searchParams.country);
  const scope = toSingleValue(searchParams.scope);
  const sourceSystem = toSingleValue(searchParams.sourceSystem) as SourceSystem | undefined;
  const from = toSingleValue(searchParams.from);
  const to = toSingleValue(searchParams.to);

  return prisma.outbreakEvent.findMany({
    where: {
      pathogen: pathogen ? { code: pathogen } : undefined,
      country: country || undefined,
      scope: scope || undefined,
      sourceSystem: sourceSystem || undefined,
      reportDate:
        from || to
          ? {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined,
            }
          : undefined,
    },
    include: {
      pathogen: true,
    },
    orderBy: [{ reportDate: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function getOutbreakDetail(id: string) {
  await ensurePathogenCatalog();

  return prisma.outbreakEvent.findUnique({
    where: { id },
    include: { pathogen: true },
  });
}
