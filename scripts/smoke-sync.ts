import "dotenv/config";

import { runManualSync } from "../src/lib/sync";

async function main() {
  const sourceSystem = (process.argv[2] ?? "WHO") as "NCBI" | "WHO" | "WOAH" | "CHINACDC";
  const pathogenCode = (process.argv[3] ?? "NIPAH") as "NIPAH" | "H5N1" | "RVF" | "XHFV";

  const job = await runManualSync({ sourceSystem, pathogenCode });

  console.log(
    JSON.stringify(
      {
        id: job.id,
        status: job.status,
        sourceSystem: job.sourceSystem,
        pathogen: job.pathogen?.code,
        fetchedCount: job.fetchedCount,
        insertedCount: job.insertedCount,
        updatedCount: job.updatedCount,
        errorSummary: job.errorSummary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
