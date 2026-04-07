import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ensurePathogenCatalog } from "@/lib/catalog";
import { runSourceSync } from "@/lib/sources";
import type {
  OutbreakInput,
  PathogenCode,
  RawDocumentInput,
  SequenceInput,
  SyncRequest,
} from "@/lib/types";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown sync error";
}

async function getPathogenOrThrow(code: PathogenCode) {
  await ensurePathogenCatalog();
  const pathogen = await prisma.pathogen.findUnique({ where: { code } });
  if (!pathogen) {
    throw new Error(`Pathogen not found: ${code}`);
  }

  return pathogen;
}

async function appendSyncJobLog(
  syncJobId: string,
  message: string,
  metadata?: unknown,
  level = "INFO",
) {
  return prisma.syncJobLog.create({
    data: {
      syncJobId,
      level,
      message,
      ...(metadata !== undefined ? { metadata: toJsonValue(metadata) } : {}),
    },
  });
}

async function upsertSequence(pathogenId: string, sequence: SequenceInput) {
  return prisma.sequenceRecord.upsert({
    where: { accession: sequence.accession },
    update: {
      pathogenId,
      sourceSystem: sequence.sourceSystem,
      sourceId: sequence.sourceId,
      title: sequence.title,
      collectionDateRaw: sequence.collectionDateRaw,
      collectionYear: sequence.collectionYear,
      country: sequence.country,
      region: sequence.region,
      rawLocation: sequence.rawLocation,
      host: sequence.host,
      strainOrSubtype: sequence.strainOrSubtype,
      sourceUrl: sequence.sourceUrl,
      sourceListUrl: sequence.sourceListUrl,
      sourceDetailUrl: sequence.sourceDetailUrl,
      navigationPath: sequence.navigationPath ? toJsonValue(sequence.navigationPath) : undefined,
      rawPayload: toJsonValue(sequence.rawPayload),
    },
    create: {
      pathogenId,
      sourceSystem: sequence.sourceSystem,
      sourceId: sequence.sourceId,
      accession: sequence.accession,
      title: sequence.title,
      collectionDateRaw: sequence.collectionDateRaw,
      collectionYear: sequence.collectionYear,
      country: sequence.country,
      region: sequence.region,
      rawLocation: sequence.rawLocation,
      host: sequence.host,
      strainOrSubtype: sequence.strainOrSubtype,
      sourceUrl: sequence.sourceUrl,
      sourceListUrl: sequence.sourceListUrl,
      sourceDetailUrl: sequence.sourceDetailUrl,
      navigationPath: sequence.navigationPath ? toJsonValue(sequence.navigationPath) : undefined,
      rawPayload: toJsonValue(sequence.rawPayload),
    },
  });
}

async function upsertOutbreak(pathogenId: string, outbreak: OutbreakInput) {
  return prisma.outbreakEvent.upsert({
    where: {
      sourceSystem_sourceId: {
        sourceSystem: outbreak.sourceSystem,
        sourceId: outbreak.sourceId,
      },
    },
    update: {
      pathogenId,
      sourceType: outbreak.sourceType,
      scope: outbreak.scope,
      title: outbreak.title,
      reportDate: outbreak.reportDate,
      eventDateRaw: outbreak.eventDateRaw,
      country: outbreak.country,
      region: outbreak.region,
      rawLocation: outbreak.rawLocation,
      hostSpecies: outbreak.hostSpecies,
      caseCount: outbreak.caseCount,
      deathCount: outbreak.deathCount,
      summary: outbreak.summary,
      sourceUrl: outbreak.sourceUrl,
      sourceListUrl: outbreak.sourceListUrl,
      sourceDetailUrl: outbreak.sourceDetailUrl,
      navigationPath: outbreak.navigationPath ? toJsonValue(outbreak.navigationPath) : undefined,
      dedupeKey: outbreak.dedupeKey,
      rawPayload: toJsonValue(outbreak.rawPayload),
    },
    create: {
      pathogenId,
      sourceSystem: outbreak.sourceSystem,
      sourceType: outbreak.sourceType,
      scope: outbreak.scope,
      sourceId: outbreak.sourceId,
      title: outbreak.title,
      reportDate: outbreak.reportDate,
      eventDateRaw: outbreak.eventDateRaw,
      country: outbreak.country,
      region: outbreak.region,
      rawLocation: outbreak.rawLocation,
      hostSpecies: outbreak.hostSpecies,
      caseCount: outbreak.caseCount,
      deathCount: outbreak.deathCount,
      summary: outbreak.summary,
      sourceUrl: outbreak.sourceUrl,
      sourceListUrl: outbreak.sourceListUrl,
      sourceDetailUrl: outbreak.sourceDetailUrl,
      navigationPath: outbreak.navigationPath ? toJsonValue(outbreak.navigationPath) : undefined,
      dedupeKey: outbreak.dedupeKey,
      rawPayload: toJsonValue(outbreak.rawPayload),
    },
  });
}

async function upsertRawDocument(pathogenId: string, document: RawDocumentInput) {
  return prisma.rawDocument.upsert({
    where: { url: document.url },
    update: {
      pathogenId,
      sourceSystem: document.sourceSystem,
      sourceListUrl: document.sourceListUrl,
      sourceDetailUrl: document.sourceDetailUrl,
      navigationPath: document.navigationPath ? toJsonValue(document.navigationPath) : undefined,
      checksum: document.checksum,
      contentType: document.contentType,
      extractedText: document.extractedText,
      rawPayload: document.rawPayload ? toJsonValue(document.rawPayload) : undefined,
    },
    create: {
      pathogenId,
      sourceSystem: document.sourceSystem,
      url: document.url,
      sourceListUrl: document.sourceListUrl,
      sourceDetailUrl: document.sourceDetailUrl,
      navigationPath: document.navigationPath ? toJsonValue(document.navigationPath) : undefined,
      checksum: document.checksum,
      contentType: document.contentType,
      extractedText: document.extractedText,
      rawPayload: document.rawPayload ? toJsonValue(document.rawPayload) : undefined,
    },
  });
}

async function createSyncJob(request: SyncRequest) {
  const pathogen = await getPathogenOrThrow(request.pathogenCode);
  const job = await prisma.syncJob.create({
    data: {
      pathogenId: pathogen.id,
      sourceSystem: request.sourceSystem,
      status: "RUNNING",
      metadata: toJsonValue({
        pathogenCode: request.pathogenCode,
        sourceSystem: request.sourceSystem,
      }),
    },
  });

  await appendSyncJobLog(job.id, "同步任务已创建，准备开始抓取官方数据。", {
    sourceSystem: request.sourceSystem,
    pathogenCode: request.pathogenCode,
  });

  return {
    jobId: job.id,
    pathogenId: pathogen.id,
  };
}

async function finalizeSyncJob(jobId: string) {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    include: {
      pathogen: true,
      logs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!job) {
    throw new Error(`Sync job not found: ${jobId}`);
  }

  return job;
}

async function executeSyncJob(jobId: string, pathogenId: string, request: SyncRequest) {
  await appendSyncJobLog(jobId, "开始抓取官方来源数据。");

  try {
    const payload = await runSourceSync(request.sourceSystem, request.pathogenCode);
    const sequences = payload.sequences ?? [];
    const outbreaks = payload.outbreaks ?? [];
    const documents = payload.documents ?? [];

    await appendSyncJobLog(jobId, "官方数据抓取完成，开始写入本地数据库。", {
      sequenceCount: sequences.length,
      outbreakCount: outbreaks.length,
      documentCount: documents.length,
    });

    let insertedCount = 0;
    let updatedCount = 0;
    let documentInsertedCount = 0;
    let documentUpdatedCount = 0;

    if (sequences.length > 0) {
      await appendSyncJobLog(jobId, `开始处理序列记录，共 ${sequences.length} 条。`);
    }

    for (const sequence of sequences) {
      const existing = await prisma.sequenceRecord.findUnique({ where: { accession: sequence.accession } });
      await upsertSequence(pathogenId, sequence);
      if (existing) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
      }
    }

    if (outbreaks.length > 0) {
      await appendSyncJobLog(jobId, `开始处理疫情事件，共 ${outbreaks.length} 条。`);
    }

    for (const outbreak of outbreaks) {
      const existing = await prisma.outbreakEvent.findUnique({
        where: {
          sourceSystem_sourceId: {
            sourceSystem: outbreak.sourceSystem,
            sourceId: outbreak.sourceId,
          },
        },
      });
      await upsertOutbreak(pathogenId, outbreak);
      if (existing) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
      }
    }

    if (documents.length > 0) {
      await appendSyncJobLog(jobId, `开始归档原始文档，共 ${documents.length} 份。`);
    }

    for (const document of documents) {
      const existing = await prisma.rawDocument.findUnique({ where: { url: document.url } });
      await upsertRawDocument(pathogenId, document);
      if (existing) {
        documentUpdatedCount += 1;
      } else {
        documentInsertedCount += 1;
      }
    }

    const fetchedCount = sequences.length + outbreaks.length;
    const metadata = {
      ...(payload.meta ?? {}),
      records: {
        sequences: sequences.length,
        outbreaks: outbreaks.length,
      },
      documents: {
        fetched: documents.length,
        inserted: documentInsertedCount,
        updated: documentUpdatedCount,
      },
    };

    await appendSyncJobLog(jobId, "数据写入完成，准备结束同步任务。", {
      fetchedCount,
      insertedCount,
      updatedCount,
      documentInsertedCount,
      documentUpdatedCount,
    });

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        fetchedCount,
        insertedCount,
        updatedCount,
        metadata: toJsonValue(metadata),
      },
    });

    await appendSyncJobLog(jobId, "同步完成。", {
      fetchedCount,
      insertedCount,
      updatedCount,
      documentCount: documents.length,
    });

    return finalizeSyncJob(jobId);
  } catch (error) {
    const message = getErrorMessage(error);

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: message,
      },
    });

    await appendSyncJobLog(
      jobId,
      "同步失败，请查看错误信息并检查目标来源是否可访问。",
      { error: message },
      "ERROR",
    );

    return finalizeSyncJob(jobId);
  }
}

export async function getSyncJobDetail(jobId: string) {
  return prisma.syncJob.findUnique({
    where: { id: jobId },
    include: {
      pathogen: true,
      logs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function runManualSync(request: SyncRequest) {
  const { jobId, pathogenId } = await createSyncJob(request);
  return executeSyncJob(jobId, pathogenId, request);
}

export async function startManualSync(request: SyncRequest) {
  const { jobId, pathogenId } = await createSyncJob(request);

  setTimeout(() => {
    void executeSyncJob(jobId, pathogenId, request);
  }, 0);

  return getSyncJobDetail(jobId);
}
