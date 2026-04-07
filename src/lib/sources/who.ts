import * as cheerio from "cheerio";

import { getPathogenCatalogEntry } from "@/lib/constants/pathogens";
import type { AdapterSyncResult, OutbreakInput, PathogenCode } from "@/lib/types";
import { fetchJson, fetchText } from "@/lib/utils/http";
import { extractCountryFromTitle, normalizeLocation } from "@/lib/utils/location";
import { compactText, extractInteger, sha256, summarizeParagraphs } from "@/lib/utils/text";

interface WhoDonFeedItem {
  Title: string;
  OverrideTitle: string;
  ItemDefaultUrl: string;
  UseOverrideTitle: boolean;
  PublicationDateAndTime: string;
  FormattedDate: string;
  EmergencyEvent?: {
    EmergencyEventStartDate?: string;
  } | null;
}

interface WhoDonFeedResponse {
  value: WhoDonFeedItem[];
}

export function parseWhoArticle(html: string) {
  const $ = cheerio.load(html);
  const paragraphs = $("main p, article p, .sf_colsIn p")
    .map((_, node) => compactText($(node).text()))
    .get()
    .filter((text) => Boolean(text) && !text.startsWith("#: Title #"));

  const textBlob = paragraphs.join(" ");
  const caseCount =
    extractInteger(textBlob, [
      /(\d+)\s+(?:laboratory-confirmed\s+)?(?:fatal\s+)?cases?/i,
    ]) ??
    (/\bone confirmed case\b/i.test(textBlob) ? 1 : null);
  const deathCount =
    extractInteger(textBlob, [/(\d+)\s+deaths?/i, /(\d+)\s+fatal cases?/i]) ??
    (caseCount === 1 && /\bdied\b/i.test(textBlob) ? 1 : null);

  return {
    paragraphs,
    summary: summarizeParagraphs(paragraphs),
    caseCount,
    deathCount,
  };
}

export async function syncWhoOutbreaks(pathogenCode: PathogenCode): Promise<AdapterSyncResult> {
  const pathogen = getPathogenCatalogEntry(pathogenCode);
  const sourceListUrl = "https://www.who.int/emergencies/disease-outbreak-news";
  const url = new URL("https://www.who.int/api/emergencies/diseaseoutbreaknews");
  url.searchParams.set("sf_provider", "dynamicProvider372");
  url.searchParams.set("sf_culture", "en");
  url.searchParams.set("$top", String(process.env.SYNC_RECORD_LIMIT ?? "25"));
  url.searchParams.set("$orderby", "PublicationDateAndTime desc");
  url.searchParams.set(
    "$select",
    "Title,TitleSuffix,OverrideTitle,UseOverrideTitle,regionscountries,ItemDefaultUrl,FormattedDate,PublicationDateAndTime",
  );
  url.searchParams.set("$expand", "EmergencyEvent");

  const feed = await fetchJson<WhoDonFeedResponse>(url.toString());
  const relevantItems = feed.value.filter((item) => {
    const title = item.UseOverrideTitle && item.OverrideTitle ? item.OverrideTitle : item.Title;
    const lower = title.toLowerCase();
    return pathogen.queryTerms.who.some((term) => lower.includes(term.toLowerCase()));
  });

  const outbreaks: OutbreakInput[] = [];
  for (const item of relevantItems) {
    const title = item.UseOverrideTitle && item.OverrideTitle ? item.OverrideTitle : item.Title;
    const articleUrl = `https://www.who.int/emergencies/disease-outbreak-news/item${item.ItemDefaultUrl}`;
    const html = await fetchText(articleUrl);
    const parsed = parseWhoArticle(html);
    const location = normalizeLocation(extractCountryFromTitle(title));
    const sourceId = item.ItemDefaultUrl.replace(/^\//, "");

    outbreaks.push({
      sourceSystem: "WHO",
      sourceType: "official_human",
      scope: "human",
      sourceId,
      title,
      reportDate: new Date(item.PublicationDateAndTime),
      eventDateRaw: item.EmergencyEvent?.EmergencyEventStartDate ?? null,
      country: location.country,
      region: location.region,
      rawLocation: location.rawLocation,
      hostSpecies: "human",
      caseCount: parsed.caseCount,
      deathCount: parsed.deathCount,
      summary: parsed.summary,
      sourceUrl: articleUrl,
      sourceListUrl,
      sourceDetailUrl: articleUrl,
      navigationPath: [
        {
          label: "WHO Disease Outbreak News",
          kind: "page",
          url: sourceListUrl,
        },
        {
          label: "WHO DON feed API",
          kind: "api",
          url: url.toString(),
        },
        {
          label: "WHO article detail",
          kind: "detail",
          url: articleUrl,
        },
      ],
      dedupeKey: sha256(`${pathogenCode}|WHO|${sourceId}`),
      rawPayload: {
        item,
        paragraphs: parsed.paragraphs,
      },
    });
  }

  return {
    outbreaks,
    meta: {
      feedCount: feed.value.length,
      matchedCount: relevantItems.length,
    },
  };
}
