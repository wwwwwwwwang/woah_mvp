export type PathogenCode = "NIPAH" | "H5N1" | "RVF" | "XHFV";

export type SourceSystem = "NCBI" | "WHO" | "WOAH" | "CHINACDC";

export type VisualizationSourceSystem = Exclude<SourceSystem, "NCBI">;

export type VisualizationWindow = "30" | "90" | "all";

export type EventScope = "human" | "animal";

export type NavigationStepKind = "page" | "api" | "detail" | "document" | "attachment";

export type SourceType =
  | "official_human"
  | "official_animal"
  | "official_surveillance"
  | "official_reference";

export interface SourceNavigationStep {
  label: string;
  kind: NavigationStepKind;
  url: string;
}

export interface PathogenCatalogEntry {
  code: PathogenCode;
  chineseName: string;
  englishName: string;
  aliases: string[];
  queryTerms: {
    ncbi: string;
    who: string[];
    woah: string[];
    chinacdc: string[];
  };
}

export interface SequenceInput {
  sourceSystem: SourceSystem;
  sourceId: string;
  accession: string;
  title: string;
  collectionDateRaw?: string | null;
  collectionYear?: number | null;
  country?: string | null;
  region?: string | null;
  rawLocation?: string | null;
  host?: string | null;
  strainOrSubtype?: string | null;
  sourceUrl: string;
  sourceListUrl?: string | null;
  sourceDetailUrl?: string | null;
  navigationPath?: SourceNavigationStep[] | null;
  rawPayload: unknown;
}

export interface OutbreakInput {
  sourceSystem: SourceSystem;
  sourceType: SourceType;
  scope: EventScope;
  sourceId: string;
  title: string;
  reportDate?: Date | null;
  eventDateRaw?: string | null;
  country?: string | null;
  region?: string | null;
  rawLocation?: string | null;
  hostSpecies?: string | null;
  caseCount?: number | null;
  deathCount?: number | null;
  summary?: string | null;
  sourceUrl: string;
  sourceListUrl?: string | null;
  sourceDetailUrl?: string | null;
  navigationPath?: SourceNavigationStep[] | null;
  dedupeKey?: string | null;
  rawPayload: unknown;
}

export interface RawDocumentInput {
  sourceSystem: SourceSystem;
  url: string;
  sourceListUrl?: string | null;
  sourceDetailUrl?: string | null;
  navigationPath?: SourceNavigationStep[] | null;
  checksum?: string | null;
  contentType?: string | null;
  extractedText?: string | null;
  rawPayload?: unknown;
}

export interface AdapterSyncResult {
  sequences?: SequenceInput[];
  outbreaks?: OutbreakInput[];
  documents?: RawDocumentInput[];
  meta?: Record<string, unknown>;
}

export interface SyncRequest {
  pathogenCode: PathogenCode;
  sourceSystem: SourceSystem;
}

export interface VisualizationFilters {
  pathogenCode: PathogenCode | null;
  sourceSystem: VisualizationSourceSystem | null;
  scope: EventScope | null;
  window: VisualizationWindow;
}

export interface CountryHeatPoint {
  country: string;
  mapName: string;
  mapId: string;
  outbreakCount: number;
  caseCount: number;
  deathCount: number;
  intensity: number;
  href: string;
}

export interface OutbreakTrendPoint {
  bucketStart: string;
  bucketEnd: string;
  label: string;
  outbreakCount: number;
  caseCount: number;
  deathCount: number;
  href: string;
}
