import type { SourceNavigationStep } from "@/lib/types";

interface SourceLinksProps {
  navigationPath?: SourceNavigationStep[] | null;
  sourceDetailUrl?: string | null;
  sourceListUrl?: string | null;
  sourceUrl: string;
}

function getStepLabel(step: SourceNavigationStep) {
  const labelByKind: Record<SourceNavigationStep["kind"], string> = {
    page: "来源入口页",
    api: "检索接口",
    detail: "详情页",
    document: "原始文档",
    attachment: "附件",
  };

  return labelByKind[step.kind] ?? step.label;
}

export function SourceLinks({ navigationPath, sourceDetailUrl, sourceListUrl, sourceUrl }: SourceLinksProps) {
  const fallbackLinks = [
    sourceListUrl
      ? {
          label: "来源入口页",
          kind: "page",
          url: sourceListUrl,
        }
      : null,
    sourceDetailUrl && sourceDetailUrl !== sourceUrl
      ? {
          label: "详情页",
          kind: "detail",
          url: sourceDetailUrl,
        }
      : null,
    {
      label: "原始文档",
      kind: "document",
      url: sourceUrl,
    },
  ].filter(Boolean) as SourceNavigationStep[];

  const links = navigationPath?.length ? navigationPath : fallbackLinks;

  return (
    <div className="source-links">
      {links.map((step) => (
        <a
          key={`${step.kind}-${step.url}`}
          href={step.url}
          target="_blank"
          rel="noreferrer"
          className="pill"
          title={step.label}
        >
          {getStepLabel(step)}
        </a>
      ))}
    </div>
  );
}
