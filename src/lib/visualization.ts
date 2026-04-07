import { readFileSync } from "node:fs";
import path from "node:path";

import { PATHOGEN_CATALOG, getPathogenCatalogEntry } from "@/lib/constants/pathogens";
import { ensurePathogenCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { formatSourceSystem, getOutbreakDisplaySummary, summarizeText } from "@/lib/presentation";
import { normalizeLocation } from "@/lib/utils/location";
import type {
  CountryHeatPoint,
  EventScope,
  OutbreakTrendPoint,
  PathogenCode,
  VisualizationFilters,
  VisualizationSourceSystem,
  VisualizationWindow,
} from "@/lib/types";

type SearchParamValue = string | string[] | undefined;

type DistributionPoint = {
  key: string;
  label: string;
  value: number;
  href: string;
};

type CountryRankingPoint = CountryHeatPoint & {
  label: string;
};

type LatestOutbreakPoint = {
  id: string;
  title: string;
  sourceSystem: VisualizationSourceSystem;
  reportDate: string | null;
  country: string | null;
  region: string | null;
  pathogenCode: PathogenCode;
  pathogenName: string;
  signalSummary: string;
  href: string;
};

type SequenceCountryPoint = {
  country: string;
  count: number;
  href: string;
};

type SequenceInsights = {
  totalCount: number;
  pathogenDistribution: DistributionPoint[];
  countryRanking: SequenceCountryPoint[];
};

export type VisualizationSnapshot = {
  filters: VisualizationFilters;
  windowLabel: string;
  lastSuccessfulSyncAt: string | null;
  kpis: {
    outbreakCount: number;
    countryCount: number;
    humanCount: number;
    animalCount: number;
    caseCount: number;
    deathCount: number;
  };
  mapData: CountryHeatPoint[];
  trendData: OutbreakTrendPoint[];
  pathogenDistribution: DistributionPoint[];
  sourceDistribution: DistributionPoint[];
  scopeDistribution: DistributionPoint[];
  countryRanking: CountryRankingPoint[];
  latestOutbreaks: LatestOutbreakPoint[];
  sequenceInsights: SequenceInsights;
};

type WorldCountryGeometry = {
  id: string;
  properties?: {
    name?: string;
  };
};

type WorldCountryTopology = {
  objects?: {
    countries?: {
      geometries?: WorldCountryGeometry[];
    };
  };
};

const VISUALIZATION_SOURCES: VisualizationSourceSystem[] = ["WHO", "WOAH", "CHINACDC"];
const VISUALIZATION_WINDOWS: VisualizationWindow[] = ["30", "90", "all"];

const MAP_ASSET_FILE = path.join(process.cwd(), "public", "maps", "world-countries-110m.json");
const MAP_TOPOLOGY = JSON.parse(readFileSync(MAP_ASSET_FILE, "utf8")) as WorldCountryTopology;
const MAP_GEOMETRIES = MAP_TOPOLOGY.objects?.countries?.geometries ?? [];
const WORLD_COUNTRY_NAME_TO_META = new Map(
  MAP_GEOMETRIES.map((geometry) => [geometry.properties?.name ?? "", { id: geometry.id, name: geometry.properties?.name ?? "" }]),
);

const MAP_COUNTRY_ALIASES: Record<string, string> = {
  "United States": "United States of America",
  USA: "United States of America",
  "U.S.": "United States of America",
  "U.S.A.": "United States of America",
  "Republic of Korea": "South Korea",
  "Korea, Republic of": "South Korea",
  "Republic of the Congo": "Congo",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "DR Congo": "Dem. Rep. Congo",
  "Central African Republic": "Central African Rep.",
  "Equatorial Guinea": "Eq. Guinea",
  "Dominican Republic": "Dominican Rep.",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Western Sahara": "W. Sahara",
  "South Sudan": "S. Sudan",
  "North Macedonia": "Macedonia",
  Eswatini: "eSwatini",
  "The Gambia": "Gambia",
  "Cote d'Ivoire": "C么te d'Ivoire",
  "Côte d'Ivoire": "C么te d'Ivoire",
};

function toSingleValue(value?: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateParam(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatWindowLabel(window: VisualizationWindow) {
  if (window === "30") {
    return "近 30 天";
  }

  if (window === "all") {
    return "全部历史";
  }

  return "近 90 天";
}

function buildWindowStartDate(window: VisualizationWindow) {
  if (window === "all") {
    return null;
  }

  const days = window === "30" ? 30 : 90;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function normalizeVisualizationSourceSystem(
  value?: string | null,
): VisualizationSourceSystem | null {
  if (!value || !VISUALIZATION_SOURCES.includes(value as VisualizationSourceSystem)) {
    return null;
  }

  return value as VisualizationSourceSystem;
}

function normalizeVisualizationWindow(value?: string | null): VisualizationWindow {
  if (!value || !VISUALIZATION_WINDOWS.includes(value as VisualizationWindow)) {
    return "90";
  }

  return value as VisualizationWindow;
}

function normalizeVisualizationScope(value?: string | null): EventScope | null {
  if (value === "human" || value === "animal") {
    return value;
  }

  return null;
}

function normalizeVisualizationPathogen(value?: string | null): PathogenCode | null {
  if (!value) {
    return null;
  }

  const match = PATHOGEN_CATALOG.find((pathogen) => pathogen.code === value);
  return match?.code ?? null;
}

export function parseVisualizationFilters(searchParams: Record<string, SearchParamValue>): VisualizationFilters {
  return {
    pathogenCode: normalizeVisualizationPathogen(toSingleValue(searchParams.pathogen) ?? null),
    sourceSystem: normalizeVisualizationSourceSystem(toSingleValue(searchParams.sourceSystem) ?? null),
    scope: normalizeVisualizationScope(toSingleValue(searchParams.scope) ?? null),
    window: normalizeVisualizationWindow(toSingleValue(searchParams.window) ?? null),
  };
}

function buildBaseOutbreakParams(filters: VisualizationFilters) {
  const params = new URLSearchParams();

  if (filters.pathogenCode) {
    params.set("pathogen", filters.pathogenCode);
  }

  if (filters.sourceSystem) {
    params.set("sourceSystem", filters.sourceSystem);
  }

  if (filters.scope) {
    params.set("scope", filters.scope);
  }

  const fromDate = buildWindowStartDate(filters.window);
  if (fromDate) {
    params.set("from", formatDateParam(fromDate));
  }

  return params;
}

export function buildVisualizationOutbreakHref(
  filters: VisualizationFilters,
  overrides: Partial<{
    pathogen: PathogenCode | null;
    sourceSystem: VisualizationSourceSystem | null;
    scope: EventScope | null;
    country: string | null;
    from: string | null;
    to: string | null;
  }> = {},
) {
  const params = buildBaseOutbreakParams(filters);

  if ("pathogen" in overrides) {
    if (overrides.pathogen) {
      params.set("pathogen", overrides.pathogen);
    } else {
      params.delete("pathogen");
    }
  }

  if ("sourceSystem" in overrides) {
    if (overrides.sourceSystem) {
      params.set("sourceSystem", overrides.sourceSystem);
    } else {
      params.delete("sourceSystem");
    }
  }

  if ("scope" in overrides) {
    if (overrides.scope) {
      params.set("scope", overrides.scope);
    } else {
      params.delete("scope");
    }
  }

  if ("country" in overrides) {
    if (overrides.country) {
      params.set("country", overrides.country);
    } else {
      params.delete("country");
    }
  }

  if ("from" in overrides) {
    if (overrides.from) {
      params.set("from", overrides.from);
    } else {
      params.delete("from");
    }
  }

  if ("to" in overrides) {
    if (overrides.to) {
      params.set("to", overrides.to);
    } else {
      params.delete("to");
    }
  }

  const query = params.toString();
  return query ? `/outbreaks?${query}` : "/outbreaks";
}

export function buildVisualizationSequenceHref(
  filters: VisualizationFilters,
  overrides: Partial<{
    pathogen: PathogenCode | null;
    country: string | null;
  }> = {},
) {
  const params = new URLSearchParams();

  const pathogen = "pathogen" in overrides ? overrides.pathogen : filters.pathogenCode;
  if (pathogen) {
    params.set("pathogen", pathogen);
  }

  if ("country" in overrides && overrides.country) {
    params.set("country", overrides.country);
  }

  const query = params.toString();
  return query ? `/sequences?${query}` : "/sequences";
}

function getUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getTrendBucketStart(date: Date, window: VisualizationWindow) {
  const current = getUtcDay(date);

  if (window === "all") {
    return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  }

  const day = current.getUTCDay();
  const distanceToMonday = day === 0 ? 6 : day - 1;
  current.setUTCDate(current.getUTCDate() - distanceToMonday);
  return current;
}

function getTrendBucketEnd(start: Date, window: VisualizationWindow) {
  const end = new Date(start);
  if (window === "all") {
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    return end;
  }

  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

function formatTrendLabel(start: Date, window: VisualizationWindow) {
  if (window === "all") {
    return `${start.getUTCFullYear()}/${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return `${String(start.getUTCMonth() + 1).padStart(2, "0")}/${String(start.getUTCDate()).padStart(2, "0")}`;
}

export function resolveMapCountry(country?: string | null) {
  if (!country) {
    return null;
  }

  const normalizedCountry = normalizeLocation(country).country ?? country.trim();
  const preferredName = MAP_COUNTRY_ALIASES[normalizedCountry] ?? normalizedCountry;
  const directMatch = WORLD_COUNTRY_NAME_TO_META.get(preferredName);

  if (directMatch) {
    return directMatch;
  }

  const fuzzyMatch = [...WORLD_COUNTRY_NAME_TO_META.values()].find(
    (entry) => entry.name.toLowerCase() === preferredName.toLowerCase(),
  );

  return fuzzyMatch ?? null;
}

function buildCountryIntensity(outbreakCount: number, caseCount: number, deathCount: number) {
  return outbreakCount + Math.min(caseCount, 100) * 0.08 + Math.min(deathCount, 20) * 0.6;
}

function buildDistributionPoints(
  entries: Array<{ key: string; label: string; value: number; href: string }>,
) {
  return entries
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 10);
}

function sumNullable(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export async function getVisualizationData(filters: VisualizationFilters): Promise<VisualizationSnapshot> {
  await ensurePathogenCatalog();

  const startDate = buildWindowStartDate(filters.window);

  const outbreakWhere = {
    pathogen: filters.pathogenCode ? { code: filters.pathogenCode } : undefined,
    sourceSystem: filters.sourceSystem ?? undefined,
    scope: filters.scope ?? undefined,
    reportDate: startDate ? { gte: startDate } : undefined,
  };

  const [outbreaks, sequenceRecords, latestSuccessfulSync] = await Promise.all([
    prisma.outbreakEvent.findMany({
      where: outbreakWhere,
      orderBy: [{ reportDate: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        country: true,
        region: true,
        sourceSystem: true,
        scope: true,
        reportDate: true,
        caseCount: true,
        deathCount: true,
        summary: true,
        rawPayload: true,
        pathogen: {
          select: {
            code: true,
            chineseName: true,
          },
        },
      },
    }),
    prisma.sequenceRecord.findMany({
      where: {
        pathogen: filters.pathogenCode ? { code: filters.pathogenCode } : undefined,
      },
      select: {
        country: true,
        pathogen: {
          select: {
            code: true,
            chineseName: true,
          },
        },
      },
    }),
    prisma.syncJob.findFirst({
      where: {
        status: "SUCCESS",
        sourceSystem: filters.sourceSystem ?? undefined,
        pathogen: filters.pathogenCode ? { code: filters.pathogenCode } : undefined,
      },
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
      },
    }),
  ]);

  const uniqueCountries = new Set(outbreaks.map((outbreak) => outbreak.country).filter(Boolean));
  const humanCount = outbreaks.filter((outbreak) => outbreak.scope === "human").length;
  const animalCount = outbreaks.filter((outbreak) => outbreak.scope === "animal").length;
  const caseCount = sumNullable(outbreaks.map((outbreak) => outbreak.caseCount));
  const deathCount = sumNullable(outbreaks.map((outbreak) => outbreak.deathCount));

  const countryAggregation = new Map<
    string,
    { country: string; mapId: string; mapName: string; outbreakCount: number; caseCount: number; deathCount: number }
  >();
  const pathogenAggregation = new Map<string, { label: string; value: number; href: string }>();
  const sourceAggregation = new Map<string, { label: string; value: number; href: string }>();
  const scopeAggregation = new Map<string, { label: string; value: number; href: string }>();
  const trendAggregation = new Map<string, OutbreakTrendPoint>();
  const sequencePathogenAggregation = new Map<string, { label: string; value: number; href: string }>();
  const sequenceCountryAggregation = new Map<string, SequenceCountryPoint>();

  for (const outbreak of outbreaks) {
    const countryMeta = resolveMapCountry(outbreak.country);
    if (countryMeta && outbreak.country) {
      const current = countryAggregation.get(countryMeta.id) ?? {
        country: outbreak.country,
        mapId: countryMeta.id,
        mapName: countryMeta.name,
        outbreakCount: 0,
        caseCount: 0,
        deathCount: 0,
      };

      current.outbreakCount += 1;
      current.caseCount += outbreak.caseCount ?? 0;
      current.deathCount += outbreak.deathCount ?? 0;
      countryAggregation.set(countryMeta.id, current);
    }

    const pathogenKey = outbreak.pathogen.code as PathogenCode;
    const pathogenEntry = pathogenAggregation.get(pathogenKey) ?? {
      label: outbreak.pathogen.chineseName,
      value: 0,
      href: buildVisualizationOutbreakHref(filters, { pathogen: pathogenKey }),
    };
    pathogenEntry.value += 1;
    pathogenAggregation.set(pathogenKey, pathogenEntry);

    const sourceKey = outbreak.sourceSystem;
    const sourceEntry = sourceAggregation.get(sourceKey) ?? {
      label: formatSourceSystem(sourceKey),
      value: 0,
      href: buildVisualizationOutbreakHref(filters, { sourceSystem: sourceKey as VisualizationSourceSystem }),
    };
    sourceEntry.value += 1;
    sourceAggregation.set(sourceKey, sourceEntry);

    const scopeKey = outbreak.scope as EventScope;
    const scopeEntry = scopeAggregation.get(scopeKey) ?? {
      label: scopeKey === "human" ? "人群事件" : "动物事件",
      value: 0,
      href: buildVisualizationOutbreakHref(filters, { scope: scopeKey }),
    };
    scopeEntry.value += 1;
    scopeAggregation.set(scopeKey, scopeEntry);

    if (outbreak.reportDate) {
      const bucketStart = getTrendBucketStart(outbreak.reportDate, filters.window);
      const bucketEnd = getTrendBucketEnd(bucketStart, filters.window);
      const bucketKey = bucketStart.toISOString();
      const current = trendAggregation.get(bucketKey) ?? {
        bucketStart: bucketStart.toISOString(),
        bucketEnd: bucketEnd.toISOString(),
        label: formatTrendLabel(bucketStart, filters.window),
        outbreakCount: 0,
        caseCount: 0,
        deathCount: 0,
        href: buildVisualizationOutbreakHref(filters, {
          from: formatDateParam(bucketStart),
          to: formatDateParam(bucketEnd),
        }),
      };

      current.outbreakCount += 1;
      current.caseCount += outbreak.caseCount ?? 0;
      current.deathCount += outbreak.deathCount ?? 0;
      trendAggregation.set(bucketKey, current);
    }
  }

  for (const sequence of sequenceRecords) {
    const pathogenKey = sequence.pathogen.code as PathogenCode;
    const pathogenEntry = sequencePathogenAggregation.get(pathogenKey) ?? {
      label: sequence.pathogen.chineseName,
      value: 0,
      href: buildVisualizationSequenceHref(filters, { pathogen: pathogenKey }),
    };
    pathogenEntry.value += 1;
    sequencePathogenAggregation.set(pathogenKey, pathogenEntry);

    if (sequence.country) {
      const current = sequenceCountryAggregation.get(sequence.country) ?? {
        country: sequence.country,
        count: 0,
        href: buildVisualizationSequenceHref(filters, { country: sequence.country }),
      };
      current.count += 1;
      sequenceCountryAggregation.set(sequence.country, current);
    }
  }

  const mapData = [...countryAggregation.values()]
    .map((entry) => ({
      country: entry.country,
      mapId: entry.mapId,
      mapName: entry.mapName,
      outbreakCount: entry.outbreakCount,
      caseCount: entry.caseCount,
      deathCount: entry.deathCount,
      intensity: buildCountryIntensity(entry.outbreakCount, entry.caseCount, entry.deathCount),
      href: buildVisualizationOutbreakHref(filters, { country: entry.country }),
    }))
    .sort((left, right) => right.intensity - left.intensity || left.country.localeCompare(right.country));

  const countryRanking = mapData.slice(0, 10).map((entry) => ({
    ...entry,
    label: entry.country,
  }));

  const latestOutbreaks = outbreaks.slice(0, 6).map((outbreak) => ({
    id: outbreak.id,
    title: outbreak.title,
    sourceSystem: outbreak.sourceSystem as VisualizationSourceSystem,
    reportDate: outbreak.reportDate?.toISOString() ?? null,
    country: outbreak.country,
    region: outbreak.region,
    pathogenCode: outbreak.pathogen.code as PathogenCode,
    pathogenName: outbreak.pathogen.chineseName,
    signalSummary: summarizeText(getOutbreakDisplaySummary(outbreak.summary, outbreak.rawPayload), 96),
    href: `/outbreaks/${outbreak.id}`,
  }));

  return {
    filters,
    windowLabel: formatWindowLabel(filters.window),
    lastSuccessfulSyncAt: latestSuccessfulSync?.startedAt.toISOString() ?? null,
    kpis: {
      outbreakCount: outbreaks.length,
      countryCount: uniqueCountries.size,
      humanCount,
      animalCount,
      caseCount,
      deathCount,
    },
    mapData,
    trendData: [...trendAggregation.values()].sort((left, right) => left.bucketStart.localeCompare(right.bucketStart)),
    pathogenDistribution: buildDistributionPoints(
      [...pathogenAggregation.entries()].map(([key, entry]) => ({ key, ...entry })),
    ),
    sourceDistribution: buildDistributionPoints(
      [...sourceAggregation.entries()].map(([key, entry]) => ({ key, ...entry })),
    ),
    scopeDistribution: buildDistributionPoints(
      [...scopeAggregation.entries()].map(([key, entry]) => ({ key, ...entry })),
    ),
    countryRanking,
    latestOutbreaks,
    sequenceInsights: {
      totalCount: sequenceRecords.length,
      pathogenDistribution: buildDistributionPoints(
        [...sequencePathogenAggregation.entries()].map(([key, entry]) => ({ key, ...entry })),
      ),
      countryRanking: [...sequenceCountryAggregation.values()]
        .sort((left, right) => right.count - left.count || left.country.localeCompare(right.country))
        .slice(0, 8),
    },
  };
}

export function getVisualizationFilterOptions() {
  return {
    pathogens: PATHOGEN_CATALOG,
    sources: VISUALIZATION_SOURCES,
    scopes: [
      { value: "human", label: "人群事件" },
      { value: "animal", label: "动物事件" },
    ] as const,
    windows: [
      { value: "30", label: "近 30 天" },
      { value: "90", label: "近 90 天" },
      { value: "all", label: "全部历史" },
    ] as const,
  };
}

export function getVisualizationTitle(filters: VisualizationFilters) {
  if (!filters.pathogenCode) {
    return "全球疫情态势驾驶舱";
  }

  return `${getPathogenCatalogEntry(filters.pathogenCode).chineseName} 态势驾驶舱`;
}
