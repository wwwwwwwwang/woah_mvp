"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PATHOGEN_CATALOG } from "@/lib/constants/pathogens";
import {
  formatDisplayDate,
  formatStatus,
  getDataListHref,
  getStatusClassName,
} from "@/lib/presentation";
import type { PathogenCode, SourceSystem } from "@/lib/types";

interface SyncJobLog {
  id: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface SyncJobPayload {
  id: string;
  status: string;
  sourceSystem: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  errorSummary: string | null;
  pathogen?: {
    code: string;
    chineseName: string;
  } | null;
  logs: SyncJobLog[];
}

interface SyncResponse {
  job?: SyncJobPayload | null;
  error?: string;
}

const SOURCES: SourceSystem[] = ["NCBI", "WHO", "WOAH", "CHINACDC"];
const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED"]);

function formatLogLevel(level: string) {
  if (level === "ERROR") {
    return "错误";
  }

  if (level === "WARN") {
    return "警告";
  }

  return "信息";
}

function formatLogTime(value: string) {
  return formatDisplayDate(value, "milliseconds");
}

function getLogMetadataEntries(metadata?: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function formatLogValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "复杂数据";
  }
}

export function SyncConsole() {
  const router = useRouter();
  const [sourceSystem, setSourceSystem] = useState<SourceSystem>("NCBI");
  const [pathogenCode, setPathogenCode] = useState<PathogenCode>("NIPAH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<SyncJobPayload | null>(null);

  const isRunning = activeJob?.status === "RUNNING";
  const isBusy = isSubmitting || isRunning;
  const dataListHref = activeJob
    ? getDataListHref(activeJob.sourceSystem, activeJob.pathogen?.code ?? null)
    : null;

  useEffect(() => {
    if (!activeJob || TERMINAL_STATUSES.has(activeJob.status)) {
      return undefined;
    }

    const currentJobId = activeJob.id;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function pollJob() {
      try {
        const response = await fetch(`/api/admin/sync/${currentJobId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as SyncResponse;

        if (!response.ok || !payload.job) {
          throw new Error(payload.error ?? "获取同步状态失败");
        }

        if (cancelled) {
          return;
        }

        setActiveJob(payload.job);
        setPollError(null);

        if (TERMINAL_STATUSES.has(payload.job.status)) {
          router.refresh();
          return;
        }

        timeoutId = setTimeout(pollJob, 1500);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPollError(error instanceof Error ? error.message : "获取同步状态失败，正在重试");
        timeoutId = setTimeout(pollJob, 2500);
      }
    }

    timeoutId = setTimeout(pollJob, 1200);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeJob, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setIsSubmitting(true);
    setRequestError(null);
    setPollError(null);
    setActiveJob(null);

    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceSystem, pathogenCode }),
      });
      const payload = (await response.json()) as SyncResponse;

      if (!response.ok || !payload.job) {
        throw new Error(payload.error ?? "同步任务创建失败");
      }

      setActiveJob(payload.job);
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unknown request error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sync-console">
      <form className="filters" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="sync-source">来源</label>
          <select
            id="sync-source"
            value={sourceSystem}
            disabled={isBusy}
            onChange={(event) => setSourceSystem(event.target.value as SourceSystem)}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sync-pathogen">病原</label>
          <select
            id="sync-pathogen"
            value={pathogenCode}
            disabled={isBusy}
            onChange={(event) => setPathogenCode(event.target.value as PathogenCode)}
          >
            {PATHOGEN_CATALOG.map((pathogen) => (
              <option key={pathogen.code} value={pathogen.code}>
                {pathogen.chineseName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sync-submit">执行同步</label>
          <button id="sync-submit" type="submit" className="button" disabled={isBusy}>
            {isBusy ? "同步进行中..." : "开始同步"}
          </button>
        </div>
      </form>

      <div className="sync-console__hint">
        同步任务会在后台执行。当前面板会持续刷新状态和详细日志，任务完成后可直接跳转查看同步数据。
      </div>

      {requestError ? <div className="status-failed">{requestError}</div> : null}
      {pollError ? <div className="status-running">{pollError}</div> : null}

      {activeJob ? (
        <div className="card section-card">
          <div className="section-heading">
            <div>
              <h2>{isRunning ? "同步进行中" : "同步结果"}</h2>
              <p className="section-lead">
                {isRunning
                  ? "任务已在后台启动，你可以留在当前页面观察处理过程。"
                  : "同步已结束，下面展示本次任务的处理结果和过程日志。"}
              </p>
            </div>
            <span className={getStatusClassName(activeJob.status)}>{formatStatus(activeJob.status)}</span>
          </div>

          <div className="detail-list">
            <div className="detail-item">
              <strong>任务 ID</strong>
              {activeJob.id}
            </div>
            <div className="detail-item">
              <strong>来源 / 病原</strong>
              {activeJob.sourceSystem} / {activeJob.pathogen?.chineseName ?? activeJob.pathogen?.code ?? "-"}
            </div>
            <div className="detail-item">
              <strong>开始时间</strong>
              {formatDisplayDate(activeJob.startedAt, true)}
            </div>
            <div className="detail-item">
              <strong>结束时间</strong>
              {activeJob.finishedAt ? formatDisplayDate(activeJob.finishedAt, true) : "进行中"}
            </div>
            <div className="detail-item">
              <strong>抓取记录</strong>
              {activeJob.fetchedCount}
            </div>
            <div className="detail-item">
              <strong>新增 / 更新</strong>
              {activeJob.insertedCount} / {activeJob.updatedCount}
            </div>
            <div className="detail-item">
              <strong>日志条数</strong>
              {activeJob.logs.length}
            </div>
          </div>

          {activeJob.status === "SUCCESS" && dataListHref ? (
            <div className="card-actions">
              <Link href={dataListHref} className="pill">
                查看同步数据
              </Link>
            </div>
          ) : null}

          {activeJob.errorSummary ? <div className="status-failed">{activeJob.errorSummary}</div> : null}

          <div className="sync-log-panel">
            <div className="section-heading">
              <div>
                <h2>同步日志</h2>
                <p className="section-lead">用于观察当前任务已经完成到哪一步，以及每一步的处理数量。</p>
              </div>
              <span className="muted">{activeJob.logs.length} 条</span>
            </div>

            {activeJob.logs.length > 0 ? (
              <div className="sync-log-list">
                {activeJob.logs.map((log) => {
                  const metadataEntries = getLogMetadataEntries(log.metadata);

                  return (
                    <div className="sync-log-item" key={log.id}>
                      <div className="sync-log-item__header">
                        <span className="pill">{formatLogTime(log.createdAt)}</span>
                        <span className={log.level === "ERROR" ? "status-failed" : "muted"}>
                          {formatLogLevel(log.level)}
                        </span>
                      </div>
                      <p>{log.message}</p>
                      {metadataEntries.length > 0 ? (
                        <div className="badge-row">
                          {metadataEntries.map(([key, value]) => (
                            <span className="badge" key={`${log.id}-${key}`}>
                              {key}: {formatLogValue(value)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <h3>日志尚未生成</h3>
                <p>任务创建后，系统会在这里持续写入抓取、入库和异常信息。</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
