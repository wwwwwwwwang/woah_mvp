import * as cheerio from "cheerio";

import { getPathogenCatalogEntry } from "@/lib/constants/pathogens";
import type {
  AdapterSyncResult,
  OutbreakInput,
  PathogenCode,
  RawDocumentInput,
  SourceNavigationStep,
} from "@/lib/types";
import { fetchArrayBuffer, fetchText } from "@/lib/utils/http";
import { normalizeLocation } from "@/lib/utils/location";
import { parsePdfText } from "@/lib/utils/pdf";
import { compactText, firstMatchingKeyword, sha256 } from "@/lib/utils/text";

interface ChinaCdcSourceConfig {
  detailMode: "direct_pdf" | "detail_pdf";
  listUrl: string;
  maxPages: number;
  scope: OutbreakInput["scope"];
  sourceType: OutbreakInput["sourceType"];
  titleIncludes: string[];
}

interface ChinaCdcListEntry {
  detailUrl: string;
  listUrl: string;
  publishedAtRaw: string | null;
  title: string;
}

interface ChinaCdcResolvedEntry extends ChinaCdcListEntry {
  documentUrl: string;
  sourceDetailUrl: string | null;
}

const CHINA_CDC_CONFIGS: Record<PathogenCode, ChinaCdcSourceConfig[]> = {
  NIPAH: [
    {
      detailMode: "direct_pdf",
      listUrl: "https://www.chinacdc.cn/jksj/jksj03/index.html",
      maxPages: 3,
      scope: "human",
      sourceType: "official_surveillance",
      titleIncludes: ["全球传染病事件风险评估"],
    },
  ],
  H5N1: [
    {
      detailMode: "detail_pdf",
      listUrl: "https://www.chinacdc.cn/jksj/jksj04_14249/index.html",
      maxPages: 3,
      scope: "human",
      sourceType: "official_surveillance",
      titleIncludes: ["流感监测周报"],
    },
    {
      detailMode: "direct_pdf",
      listUrl: "https://www.chinacdc.cn/jksj/jksj03/index.html",
      maxPages: 2,
      scope: "human",
      sourceType: "official_surveillance",
      titleIncludes: ["全球传染病事件风险评估"],
    },
  ],
  RVF: [
    {
      detailMode: "direct_pdf",
      listUrl: "https://www.chinacdc.cn/jksj/jksj03/index.html",
      maxPages: 3,
      scope: "human",
      sourceType: "official_surveillance",
      titleIncludes: ["全球传染病事件风险评估"],
    },
  ],
  XHFV: [
    {
      detailMode: "direct_pdf",
      listUrl: "https://www.chinacdc.cn/jksj/jksj03/index.html",
      maxPages: 3,
      scope: "human",
      sourceType: "official_surveillance",
      titleIncludes: ["全球传染病事件风险评估"],
    },
  ],
};

function parseChinaCdcDate(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00+08:00`);
  }

  const yearMonthMatch = value.match(/(20\d{2})年(\d{1,2})月/);
  if (yearMonthMatch) {
    const month = yearMonthMatch[2].padStart(2, "0");
    return new Date(`${yearMonthMatch[1]}-${month}-01T00:00:00+08:00`);
  }

  return null;
}

function parseChinaCdcListPage(html: string, pageUrl: string, config: ChinaCdcSourceConfig) {
  const $ = cheerio.load(html);
  const entries: ChinaCdcListEntry[] = [];
  const nextPages = new Set<string>();

  $("li a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    if (config.detailMode === "detail_pdf" && !/\.html($|\?)/i.test(href)) {
      return;
    }

    if (config.detailMode === "direct_pdf" && !/\.pdf($|\?)/i.test(href)) {
      return;
    }

    const titleNode = $(element).clone();
    titleNode.find("span").remove();
    const title = compactText(titleNode.text());
    if (!title || !config.titleIncludes.some((needle) => title.includes(needle))) {
      return;
    }

    const publishedAtRaw = compactText($(element).find("span").first().text()) || null;
    entries.push({
      title,
      publishedAtRaw,
      listUrl: pageUrl,
      detailUrl: new URL(href, pageUrl).toString(),
    });
  });

  $(".fya a, .page a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || !/index(_\d+)?\.html$/i.test(href)) {
      return;
    }

    nextPages.add(new URL(href, pageUrl).toString());
  });

  return {
    entries,
    nextPages: [...nextPages],
  };
}

async function collectChinaCdcEntries(config: ChinaCdcSourceConfig) {
  const seenPages = new Set<string>();
  const queue = [config.listUrl];
  const entries: ChinaCdcListEntry[] = [];

  while (queue.length && seenPages.size < config.maxPages) {
    const pageUrl = queue.shift();
    if (!pageUrl || seenPages.has(pageUrl)) {
      continue;
    }

    seenPages.add(pageUrl);
    const html = await fetchText(pageUrl);
    const parsed = parseChinaCdcListPage(html, pageUrl, config);
    entries.push(...parsed.entries);

    for (const nextPage of parsed.nextPages) {
      if (!seenPages.has(nextPage)) {
        queue.push(nextPage);
      }
    }
  }

  const deduped = new Map<string, ChinaCdcListEntry>();
  for (const entry of entries) {
    deduped.set(entry.detailUrl, entry);
  }

  return [...deduped.values()];
}

async function resolveChinaCdcDocument(entry: ChinaCdcListEntry, config: ChinaCdcSourceConfig): Promise<ChinaCdcResolvedEntry> {
  if (config.detailMode === "direct_pdf") {
    return {
      ...entry,
      documentUrl: entry.detailUrl,
      sourceDetailUrl: null,
    };
  }

  const html = await fetchText(entry.detailUrl);
  const $ = cheerio.load(html);
  const attachmentHref =
    $('a[href$=".pdf"]').first().attr("href") ??
    $("a")
      .map((_, node) => $(node).attr("href"))
      .get()
      .find((href) => Boolean(href) && /\.pdf($|\?)/i.test(String(href)));

  if (!attachmentHref) {
    throw new Error(`China CDC detail page does not contain a PDF attachment: ${entry.detailUrl}`);
  }

  return {
    ...entry,
    documentUrl: new URL(attachmentHref, entry.detailUrl).toString(),
    sourceDetailUrl: entry.detailUrl,
  };
}

function buildChinaCdcNavigationPath(entry: ChinaCdcResolvedEntry): SourceNavigationStep[] {
  const steps: SourceNavigationStep[] = [
    {
      label: "China CDC list page",
      kind: "page",
      url: entry.listUrl,
    },
  ];

  if (entry.sourceDetailUrl) {
    steps.push({
      label: "China CDC detail page",
      kind: "detail",
      url: entry.sourceDetailUrl,
    });
  }

  steps.push({
    label: "China CDC PDF document",
    kind: "document",
    url: entry.documentUrl,
  });

  return steps;
}

function extractChinaCdcSummary(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  const preferredMinimumIndex = 800;

  let bestKeyword: string | null = null;
  let bestIndex = -1;

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    let searchFrom = 0;
    let firstIndex = -1;

    while (searchFrom < lower.length) {
      const index = lower.indexOf(keywordLower, searchFrom);
      if (index === -1) {
        break;
      }

      if (firstIndex === -1) {
        firstIndex = index;
      }

      if (index >= preferredMinimumIndex) {
        return {
          matchedKeyword: keyword,
          summary: compactText(text.slice(Math.max(0, index - 180), Math.min(text.length, index + keyword.length + 180))),
        };
      }

      searchFrom = index + keywordLower.length;
    }

    if (firstIndex !== -1 && (bestIndex === -1 || firstIndex < bestIndex)) {
      bestIndex = firstIndex;
      bestKeyword = keyword;
    }
  }

  if (!bestKeyword || bestIndex === -1) {
    return null;
  }

  return {
    matchedKeyword: bestKeyword,
    summary: compactText(text.slice(Math.max(0, bestIndex - 180), Math.min(text.length, bestIndex + bestKeyword.length + 180))),
  };
}

export function buildChinaCdcOutbreakFromText(
  text: string,
  entry: ChinaCdcResolvedEntry,
  pathogenCode: PathogenCode,
  config: ChinaCdcSourceConfig,
): OutbreakInput | null {
  const pathogen = getPathogenCatalogEntry(pathogenCode);
  const normalizedText = compactText(text);
  const matchedKeyword = firstMatchingKeyword(normalizedText, pathogen.queryTerms.chinacdc);
  if (!matchedKeyword) {
    return null;
  }

  const summaryResult = extractChinaCdcSummary(normalizedText, pathogen.queryTerms.chinacdc);
  if (!summaryResult) {
    return null;
  }

  const summary = summaryResult.summary;
  const location = normalizeLocation(summary);
  const reportDate = parseChinaCdcDate(entry.publishedAtRaw);

  return {
    sourceSystem: "CHINACDC",
    sourceType: config.sourceType,
    scope: config.scope,
    sourceId: sha256(entry.documentUrl).slice(0, 24),
    title: entry.title,
    reportDate,
    eventDateRaw: entry.publishedAtRaw,
    country: location.country,
    region: location.region,
    rawLocation: location.rawLocation,
    hostSpecies: config.scope === "human" ? "human" : null,
    caseCount: null,
    deathCount: null,
    summary,
    sourceUrl: entry.documentUrl,
    sourceListUrl: entry.listUrl,
    sourceDetailUrl: entry.sourceDetailUrl ?? entry.documentUrl,
    navigationPath: buildChinaCdcNavigationPath(entry),
    dedupeKey: sha256(`${pathogen.code}|CHINACDC|${entry.documentUrl}`),
    rawPayload: {
      entry,
      matchedKeyword: summaryResult.matchedKeyword,
      summary,
    },
  };
}

export async function syncChinaCdcOutbreaks(pathogenCode: PathogenCode): Promise<AdapterSyncResult> {
  const limit = Number(process.env.SYNC_RECORD_LIMIT ?? "25");
  const configs = CHINA_CDC_CONFIGS[pathogenCode] ?? [];
  const outbreaks: OutbreakInput[] = [];
  const documents: RawDocumentInput[] = [];

  let scannedEntries = 0;
  for (const config of configs) {
    const entries = await collectChinaCdcEntries(config);
    for (const entry of entries.slice(0, limit)) {
      scannedEntries += 1;
      const resolvedEntry = await resolveChinaCdcDocument(entry, config);
      const arrayBuffer = await fetchArrayBuffer(resolvedEntry.documentUrl);
      const parsed = await parsePdfText(arrayBuffer);
      const normalizedText = compactText(parsed.text);
      const checksum = sha256(normalizedText);

      const outbreak = buildChinaCdcOutbreakFromText(normalizedText, resolvedEntry, pathogenCode, config);
      if (!outbreak) {
        continue;
      }

      documents.push({
        sourceSystem: "CHINACDC",
        url: resolvedEntry.documentUrl,
        sourceListUrl: resolvedEntry.listUrl,
        sourceDetailUrl: resolvedEntry.sourceDetailUrl ?? resolvedEntry.documentUrl,
        navigationPath: buildChinaCdcNavigationPath(resolvedEntry),
        checksum,
        contentType: "application/pdf",
        extractedText: normalizedText.slice(0, 15000),
        rawPayload: {
          title: resolvedEntry.title,
          publishedAtRaw: resolvedEntry.publishedAtRaw,
          pageCount: parsed.pageCount,
        },
      });

      outbreaks.push(outbreak);
    }
  }

  return {
    outbreaks,
    documents,
    meta: {
      configuredSources: configs.length,
      scannedEntries,
      matchedCount: outbreaks.length,
    },
  };
}
