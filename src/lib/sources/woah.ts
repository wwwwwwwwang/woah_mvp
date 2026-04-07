import type {
  AdapterSyncResult,
  OutbreakInput,
  PathogenCode,
  RawDocumentInput,
  SourceNavigationStep,
} from "@/lib/types";
import { getPathogenCatalogEntry } from "@/lib/constants/pathogens";
import { fetchArrayBuffer, fetchJson } from "@/lib/utils/http";
import { normalizeLocation } from "@/lib/utils/location";
import { parsePdfText } from "@/lib/utils/pdf";
import { compactText, sha256 } from "@/lib/utils/text";

interface WoahEventFilters {
  animalTypes: string[];
  countries: string[];
  eventIds: number[];
  eventStartDate: null;
  eventStatuses: string[];
  firstDiseases: string[];
  reasons: string[];
  reportIds: number[];
  reportStatuses: string[];
  reportTypes: string[];
  secondDiseases: string[];
  sortColumn: "submissionDate";
  sortOrder: "DESC";
  submissionDate: null;
  typeStatuses: string[];
  pageNumber: number;
  pageSize: number;
}

interface WoahFilteredListItem {
  reportId: number;
  createdBy: string;
  eventId: number;
  country: string;
  disease: string;
  subType: string | null;
  eventStartDate: string;
  eventStatus: string;
  reason: string;
  reportType: string;
  reportStatus: string;
  submissionDate: string;
  reportNumber: number;
  isAquatic: boolean;
  isLastReportUnchanged: boolean;
}

interface WoahFilteredListResponse {
  list: WoahFilteredListItem[];
  totalSize: number;
  pageSize: number;
  pageNumber: number;
  sortColumn: string | null;
  sortOrder: string | null;
}

interface ParsedWoahPdf {
  affectedPopulationDescription: string | null;
  caseCount: number | null;
  deathCount: number | null;
  hostSpecies: string | null;
  rawLocation: string | null;
  summary: string;
}

const WOAH_PAGE_URL = "https://wahis.woah.org/#/event-management";
const WOAH_FILTERED_LIST_API_URL = "https://wahis.woah.org/api/v1/pi/event/filtered-list?language=EN";
const WOAH_PUBLIC_HEADERS = {
  "accept-language": "EN",
  env: "PRD",
  type: "REQUEST",
  token: "#PIPRD202006#",
  clientId: "OIEwebsite",
};

function buildWoahFilters(pageNumber: number, pageSize: number): WoahEventFilters {
  return {
    animalTypes: [],
    countries: [],
    eventIds: [],
    eventStartDate: null,
    eventStatuses: [],
    firstDiseases: [],
    reasons: [],
    reportIds: [],
    reportStatuses: [],
    reportTypes: ["IN", "FUR"],
    secondDiseases: [],
    sortColumn: "submissionDate",
    sortOrder: "DESC",
    submissionDate: null,
    typeStatuses: [],
    pageNumber,
    pageSize,
  };
}

function buildWoahPdfUrl(reportId: number) {
  return `https://wahis.woah.org/api/v1/pi/pdf-generation/report/${reportId}/review-pdf?language=EN`;
}

function buildWoahNavigationPath(pdfUrl: string): SourceNavigationStep[] {
  return [
    {
      label: "WAHIS public interface",
      kind: "page",
      url: WOAH_PAGE_URL,
    },
    {
      label: "WAHIS filtered-list API",
      kind: "api",
      url: WOAH_FILTERED_LIST_API_URL,
    },
    {
      label: "WAHIS review PDF",
      kind: "document",
      url: pdfUrl,
    },
  ];
}

function matchesPathogen(item: WoahFilteredListItem, pathogenCode: PathogenCode) {
  const pathogen = getPathogenCatalogEntry(pathogenCode);
  const haystack = compactText([item.country, item.disease, item.subType ?? "", item.reason].join(" ")).toLowerCase();
  return pathogen.queryTerms.woah.some((term) => haystack.includes(term.toLowerCase()));
}

function extractWoahSection(text: string, startMarker: string, endMarkers: string[]) {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }

  const searchStart = startIndex + startMarker.length;
  const candidateEnds = endMarkers
    .map((marker) => text.indexOf(marker, searchStart))
    .filter((value) => value >= 0);

  const endIndex = candidateEnds.length ? Math.min(...candidateEnds) : text.length;
  return compactText(text.slice(searchStart, endIndex));
}

function inferWoahHostSpecies(item: WoahFilteredListItem, parsedText: string, affectedPopulationDescription: string | null) {
  const lowerDisease = item.disease.toLowerCase();
  if (lowerDisease.includes("poultry")) {
    return "poultry";
  }
  if (lowerDisease.includes("wild birds")) {
    return "wild birds";
  }
  if (lowerDisease.includes("cattle")) {
    return "cattle";
  }

  const lowerText = `${affectedPopulationDescription ?? ""} ${parsedText}`.toLowerCase();
  if (lowerText.includes("birds (domestic)")) {
    return "birds (domestic)";
  }
  if (lowerText.includes("cattle")) {
    return "cattle";
  }
  if (lowerText.includes("goat")) {
    return "goats";
  }

  return null;
}

export function parseWoahReportPdf(text: string, item: WoahFilteredListItem): ParsedWoahPdf {
  const normalizedText = text.replace(/\r/g, "");
  const summary =
    extractWoahSection(normalizedText, "EPIDEMIOLOGICAL COMMENTS", [
      "QUANTITATIVE DATA SUMMARY",
      "NEW OUTBREAKS",
      "DIAGNOSTIC DETAILS",
    ]) ??
    extractWoahSection(normalizedText, "AFFECTED POPULATION DESCRIPTION", [
      "Species Wildlife",
      "METHOD OF DIAGNOSTIC",
      "CONTROL MEASURES DIFFERENT FROM EVENT LEVEL",
    ]) ??
    compactText(normalizedText.slice(0, 1000));

  const affectedPopulationDescription =
    extractWoahSection(normalizedText, "AFFECTED POPULATION DESCRIPTION", [
      "Species Wildlife",
      "METHOD OF DIAGNOSTIC",
      "CONTROL MEASURES DIFFERENT FROM EVENT LEVEL",
    ]) ?? null;

  const totalsMatch = normalizedText.match(/TOTAL\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/);
  const rawLocationMatch = normalizedText.match(/OB_[A-Z0-9_]+\s*-\s*([^\n]+)/i);

  return {
    summary,
    affectedPopulationDescription,
    caseCount: totalsMatch ? Number(totalsMatch[2].replace(/,/g, "")) : null,
    deathCount: totalsMatch ? Number(totalsMatch[3].replace(/,/g, "")) : null,
    rawLocation: rawLocationMatch ? compactText(rawLocationMatch[1]) : null,
    hostSpecies: inferWoahHostSpecies(item, normalizedText, affectedPopulationDescription),
  };
}

async function fetchWoahEventPage(pageNumber: number, pageSize: number) {
  const body = buildWoahFilters(pageNumber, pageSize);
  const payload = await fetchJson<WoahFilteredListResponse>(WOAH_FILTERED_LIST_API_URL, {
    method: "POST",
    headers: {
      ...WOAH_PUBLIC_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    body,
    payload,
  };
}

async function collectWoahEvents(pathogenCode: PathogenCode, limit: number) {
  const matched: Array<{ body: WoahEventFilters; item: WoahFilteredListItem }> = [];
  const seenReportIds = new Set<number>();
  const pageSize = Math.min(Math.max(limit, 25), 100);
  const maxPages = 20;

  let scanned = 0;
  for (let pageNumber = 0; pageNumber < maxPages && matched.length < limit; pageNumber += 1) {
    const { body, payload } = await fetchWoahEventPage(pageNumber, pageSize);
    scanned += payload.list.length;

    for (const item of payload.list) {
      if (seenReportIds.has(item.reportId) || !matchesPathogen(item, pathogenCode)) {
        continue;
      }

      seenReportIds.add(item.reportId);
      matched.push({ item, body });
      if (matched.length >= limit) {
        break;
      }
    }

    if (!payload.list.length || (pageNumber + 1) * payload.pageSize >= payload.totalSize) {
      break;
    }
  }

  return {
    matched,
    scanned,
  };
}

export async function syncWoahOutbreaks(pathogenCode: PathogenCode): Promise<AdapterSyncResult> {
  const limit = Number(process.env.SYNC_RECORD_LIMIT ?? "25");
  const { matched, scanned } = await collectWoahEvents(pathogenCode, limit);

  const outbreaks: OutbreakInput[] = [];
  const documents: RawDocumentInput[] = [];

  for (const { item, body } of matched) {
    const pdfUrl = buildWoahPdfUrl(item.reportId);
    const arrayBuffer = await fetchArrayBuffer(pdfUrl, {
      headers: {
        ...WOAH_PUBLIC_HEADERS,
        Accept: "application/pdf,*/*",
      },
    });
    const parsedPdf = await parsePdfText(arrayBuffer);
    const parsed = parseWoahReportPdf(parsedPdf.text, item);
    const compactPdfText = compactText(parsedPdf.text);
    const normalizedLocation = normalizeLocation(item.country);

    outbreaks.push({
      sourceSystem: "WOAH",
      sourceType: "official_animal",
      scope: "animal",
      sourceId: String(item.reportId),
      title: `${item.country} - ${item.disease}${item.subType ? ` (${item.subType})` : ""}`,
      reportDate: new Date(item.submissionDate),
      eventDateRaw: item.eventStartDate,
      country: normalizedLocation.country ?? item.country,
      region: parsed.rawLocation,
      rawLocation: parsed.rawLocation,
      hostSpecies: parsed.hostSpecies,
      caseCount: parsed.caseCount,
      deathCount: parsed.deathCount,
      summary: parsed.summary,
      sourceUrl: pdfUrl,
      sourceListUrl: WOAH_PAGE_URL,
      navigationPath: buildWoahNavigationPath(pdfUrl),
      dedupeKey: sha256(`${pathogenCode}|WOAH|${item.reportId}`),
      rawPayload: {
        filters: body,
        item,
        parsed: {
          ...parsed,
          pageCount: parsedPdf.pageCount,
          excerpt: compactPdfText.slice(0, 4000),
        },
      },
    });

    documents.push({
      sourceSystem: "WOAH",
      url: pdfUrl,
      sourceListUrl: WOAH_PAGE_URL,
      navigationPath: buildWoahNavigationPath(pdfUrl),
      checksum: sha256(compactPdfText),
      contentType: "application/pdf",
      extractedText: compactPdfText.slice(0, 15000),
      rawPayload: {
        reportId: item.reportId,
        eventId: item.eventId,
        pageCount: parsedPdf.pageCount,
      },
    });
  }

  return {
    outbreaks,
    documents,
    meta: {
      scanned,
      matchedCount: matched.length,
      listPageUrl: WOAH_PAGE_URL,
      filteredListApiUrl: WOAH_FILTERED_LIST_API_URL,
    },
  };
}
