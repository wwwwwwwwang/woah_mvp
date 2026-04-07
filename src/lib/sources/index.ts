import type { AdapterSyncResult, PathogenCode, SourceSystem } from "@/lib/types";
import { syncChinaCdcOutbreaks } from "@/lib/sources/china-cdc";
import { syncNcbiSequences } from "@/lib/sources/ncbi";
import { syncWhoOutbreaks } from "@/lib/sources/who";
import { syncWoahOutbreaks } from "@/lib/sources/woah";

export async function runSourceSync(sourceSystem: SourceSystem, pathogenCode: PathogenCode): Promise<AdapterSyncResult> {
  switch (sourceSystem) {
    case "NCBI":
      return syncNcbiSequences(pathogenCode);
    case "WHO":
      return syncWhoOutbreaks(pathogenCode);
    case "WOAH":
      return syncWoahOutbreaks(pathogenCode);
    case "CHINACDC":
      return syncChinaCdcOutbreaks(pathogenCode);
    default:
      throw new Error(`Unsupported source system: ${sourceSystem}`);
  }
}
