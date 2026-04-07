import type { AdapterSyncResult, PathogenCode, SequenceInput } from "@/lib/types";
import { getPathogenCatalogEntry } from "@/lib/constants/pathogens";
import { fetchJson, fetchText } from "@/lib/utils/http";
import { extractYear } from "@/lib/utils/text";
import { normalizeLocation } from "@/lib/utils/location";

interface NcbiSearchResponse {
  esearchresult: {
    idlist: string[];
  };
}

export function parseGenBankRecords(genbankText: string): SequenceInput[] {
  return genbankText
    .split(/\n\/\/\s*/g)
    .map((record) => record.trim())
    .filter(Boolean)
    .flatMap((record) => {
      const accession = record.match(/^ACCESSION\s+([^\s]+)/m)?.[1];
      if (!accession) {
        return [];
      }

      const definition = record.match(/^DEFINITION\s+([\s\S]*?)(?=\n[A-Z]{2,}\s)/m)?.[1];
      const qualifiers = Object.fromEntries(
        [...record.matchAll(/\/([a-zA-Z_]+)="([^"]+)"/g)].map((match) => [match[1], match[2]]),
      );
      const rawLocation = qualifiers.geo_loc_name ?? qualifiers.country ?? null;
      const location = normalizeLocation(rawLocation);

      return [{
        sourceSystem: "NCBI" as const,
        sourceId: accession,
        accession,
        title: definition?.replace(/\s+/g, " ").trim() ?? accession,
        collectionDateRaw: qualifiers.collection_date ?? null,
        collectionYear: extractYear(qualifiers.collection_date ?? null),
        country: location.country,
        region: location.region,
        rawLocation: location.rawLocation,
        host: qualifiers.host ?? null,
        strainOrSubtype: qualifiers.strain ?? qualifiers.isolate ?? null,
        sourceUrl: `https://www.ncbi.nlm.nih.gov/nuccore/${accession}`,
        sourceDetailUrl: `https://www.ncbi.nlm.nih.gov/nuccore/${accession}`,
        rawPayload: {
          accession,
          definition,
          qualifiers,
        },
      } satisfies SequenceInput];
    });
}

export async function syncNcbiSequences(pathogenCode: PathogenCode): Promise<AdapterSyncResult> {
  const pathogen = getPathogenCatalogEntry(pathogenCode);
  const apiKey = process.env.NCBI_API_KEY;
  const limit = Number(process.env.SYNC_RECORD_LIMIT ?? "25");
  const sourceListUrl = `https://www.ncbi.nlm.nih.gov/nuccore/?term=${encodeURIComponent(pathogen.queryTerms.ncbi)}`;
  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  searchUrl.searchParams.set("db", "nuccore");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("retmax", String(limit));
  searchUrl.searchParams.set("sort", "most recent");
  searchUrl.searchParams.set("term", pathogen.queryTerms.ncbi);
  if (apiKey) {
    searchUrl.searchParams.set("api_key", apiKey);
  }

  const search = await fetchJson<NcbiSearchResponse>(searchUrl.toString());
  if (!search.esearchresult.idlist.length) {
    return { sequences: [] };
  }

  const fetchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
  fetchUrl.searchParams.set("db", "nuccore");
  fetchUrl.searchParams.set("rettype", "gb");
  fetchUrl.searchParams.set("retmode", "text");
  fetchUrl.searchParams.set("id", search.esearchresult.idlist.join(","));
  if (apiKey) {
    fetchUrl.searchParams.set("api_key", apiKey);
  }

  const genbankText = await fetchText(fetchUrl.toString());
  const sequences = parseGenBankRecords(genbankText).map((sequence) => ({
    ...sequence,
    sourceListUrl,
    navigationPath: [
      {
        label: "NCBI nuccore search",
        kind: "page" as const,
        url: sourceListUrl,
      },
      {
        label: "NCBI esearch API",
        kind: "api" as const,
        url: searchUrl.toString(),
      },
      {
        label: "NCBI efetch API",
        kind: "api" as const,
        url: fetchUrl.toString(),
      },
      {
        label: "NCBI nuccore detail",
        kind: "detail" as const,
        url: sequence.sourceUrl,
      },
    ],
  }));

  return {
    sequences,
    meta: {
      fetchedIds: search.esearchresult.idlist.length,
      query: pathogen.queryTerms.ncbi,
    },
  };
}
