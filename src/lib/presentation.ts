import type { EventScope, SourceSystem, SourceType } from "@/lib/types";

type OutbreakSignalInput = {
  caseCount?: number | null;
  deathCount?: number | null;
  reportDate?: Date | string | null;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDisplayText(text?: string | null) {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function truncateDisplayText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

const WEAK_OUTBREAK_SUMMARIES = new Set([
  "-",
  "n/a",
  "na",
  "none",
  "no comment",
  "no comments",
  "no epidemiological comment",
  "no epidemiological comments",
  "not available",
]);

function getOutbreakRawPayloadField(rawPayload: unknown, field: string) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return null;
  }

  const parsed =
    "parsed" in rawPayload &&
    rawPayload.parsed &&
    typeof rawPayload.parsed === "object" &&
    !Array.isArray(rawPayload.parsed)
      ? rawPayload.parsed
      : null;

  if (!parsed || !(field in parsed)) {
    return null;
  }

  const value = parsed[field as keyof typeof parsed];
  return typeof value === "string" ? normalizeDisplayText(value) : null;
}

export function hasMeaningfulOutbreakSummary(summary?: string | null) {
  const normalized = normalizeDisplayText(summary);
  if (!normalized) {
    return false;
  }

  return !WEAK_OUTBREAK_SUMMARIES.has(normalized.toLowerCase());
}

export function getOutbreakDisplaySummary(summary?: string | null, rawPayload?: unknown) {
  if (hasMeaningfulOutbreakSummary(summary)) {
    return normalizeDisplayText(summary);
  }

  return (
    getOutbreakRawPayloadField(rawPayload, "affectedPopulationDescription") ??
    getOutbreakRawPayloadField(rawPayload, "excerpt") ??
    normalizeDisplayText(summary)
  );
}

export function isOutbreakSummaryFallback(summary?: string | null, rawPayload?: unknown) {
  return !hasMeaningfulOutbreakSummary(summary) && Boolean(getOutbreakDisplaySummary(summary, rawPayload));
}

type DisplayDateMode = boolean | "seconds" | "milliseconds";

export function formatDisplayDate(
  value: Date | string | null | undefined,
  mode: DisplayDateMode = false,
) {
  const date = toDate(value);
  if (!date) {
    return "待补充";
  }

  const withTime = mode !== false;
  const withSeconds = mode === "seconds" || mode === "milliseconds";
  const withMilliseconds = mode === "milliseconds";

  return new Intl.DateTimeFormat(
    "zh-CN",
    withTime
      ? {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          ...(withSeconds ? { second: "2-digit" as const } : {}),
          ...(withMilliseconds ? { fractionalSecondDigits: 3 as const } : {}),
        }
      : {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
  ).format(date);
}

export function formatSourceSystem(sourceSystem: SourceSystem | string) {
  const sourceMap: Record<string, string> = {
    NCBI: "NCBI 序列库",
    WHO: "WHO 官方通报",
    WOAH: "WOAH 动物疫情",
    CHINACDC: "中国疾控监测",
  };

  return sourceMap[sourceSystem] ?? sourceSystem;
}

export function formatScope(scope: EventScope | string) {
  const scopeMap: Record<string, string> = {
    human: "人群事件",
    animal: "动物事件",
  };

  return scopeMap[scope] ?? scope;
}

export function formatSourceType(sourceType: SourceType | string) {
  const sourceTypeMap: Record<string, string> = {
    official_human: "官方人群通报",
    official_animal: "官方动物疫情",
    official_surveillance: "官方监测信息",
    official_reference: "官方参考信息",
  };

  return sourceTypeMap[sourceType] ?? sourceType;
}

export function formatStatus(status: string) {
  const statusMap: Record<string, string> = {
    SUCCESS: "已完成",
    FAILED: "失败",
    RUNNING: "进行中",
  };

  return statusMap[status] ?? status;
}

export function getStatusClassName(status: string) {
  if (status === "SUCCESS") {
    return "status-success";
  }

  if (status === "FAILED") {
    return "status-failed";
  }

  return "status-running";
}

export function formatLocation(country?: string | null, region?: string | null) {
  if (country && region) {
    return `${country} / ${region}`;
  }

  if (country) {
    return country;
  }

  if (region) {
    return region;
  }

  return "地点待补充";
}

export function formatValue(value?: string | number | null, fallback = "待补充") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

export function summarizeText(text?: string | null, maxLength = 120) {
  const normalized = normalizeDisplayText(text);
  if (!normalized) {
    return "暂无摘要，建议进入详情查看官方来源字段。";
  }

  return truncateDisplayText(normalized, maxLength);
}

export function getOutbreakSignalTone(input: OutbreakSignalInput) {
  if ((input.deathCount ?? 0) > 0) {
    return "critical";
  }

  if ((input.caseCount ?? 0) > 0) {
    return "watch";
  }

  const date = toDate(input.reportDate);
  if (date) {
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (diffDays <= 30) {
      return "info";
    }
  }

  return "neutral";
}

export function buildOutbreakSignalText(input: OutbreakSignalInput) {
  const caseCount = input.caseCount ?? 0;
  const deathCount = input.deathCount ?? 0;

  if (deathCount > 0 && caseCount > 0) {
    return `已报告 ${caseCount} 例病例，${deathCount} 例死亡`;
  }

  if (deathCount > 0) {
    return `已报告 ${deathCount} 例死亡`;
  }

  if (caseCount > 0) {
    return `已报告 ${caseCount} 例病例`;
  }

  const date = toDate(input.reportDate);
  if (date) {
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (diffDays <= 30) {
      return "近 30 天内有官方更新";
    }
  }

  return "建议结合事件摘要和官方原文继续研判";
}

export function getDataListHref(sourceSystem: SourceSystem | string, pathogenCode?: string | null) {
  if (!pathogenCode) {
    return null;
  }

  const encodedPathogen = encodeURIComponent(pathogenCode);

  if (sourceSystem === "NCBI") {
    return `/sequences?pathogen=${encodedPathogen}`;
  }

  return `/outbreaks?pathogen=${encodedPathogen}&sourceSystem=${encodeURIComponent(sourceSystem)}`;
}
