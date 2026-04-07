import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceLinks } from "@/components/source-links";
import {
  formatDisplayDate,
  formatLocation,
  formatScope,
  formatSourceSystem,
  formatSourceType,
  formatValue,
  getOutbreakDisplaySummary,
  isOutbreakSummaryFallback,
} from "@/lib/presentation";
import { getOutbreakDetail } from "@/lib/queries";
import type { SourceNavigationStep } from "@/lib/types";

export const dynamic = "force-dynamic";

type OutbreakDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OutbreakDetailPage({ params }: OutbreakDetailPageProps) {
  const { id } = await params;
  const outbreak = await getOutbreakDetail(id);

  if (!outbreak) {
    notFound();
  }

  const displaySummary =
    getOutbreakDisplaySummary(outbreak.summary, outbreak.rawPayload) ??
    "这是一条来自官方来源的疫情事件记录，可继续查看下方关键字段与来源链路。";
  const summaryFromFallback = isOutbreakSummaryFallback(outbreak.summary, outbreak.rawPayload);

  return (
    <div className="page-grid">
      <section className="hero">
        <p className="eyebrow">{formatSourceSystem(outbreak.sourceSystem)}</p>
        <h1>{outbreak.title}</h1>
        <p>{displaySummary}</p>
        <div className="badge-row">
          <span className="badge">病原: {outbreak.pathogen.chineseName}</span>
          <span className="badge">范围: {formatScope(outbreak.scope)}</span>
          <span className="badge">报告日期: {formatDisplayDate(outbreak.reportDate)}</span>
          <span className="badge">地点: {formatLocation(outbreak.country, outbreak.region)}</span>
          {outbreak.hostSpecies ? <span className="badge">对象: {outbreak.hostSpecies}</span> : null}
        </div>
        <div className="hero-actions">
          <SourceLinks
            sourceUrl={outbreak.sourceUrl}
            sourceListUrl={outbreak.sourceListUrl}
            sourceDetailUrl={outbreak.sourceDetailUrl}
            navigationPath={outbreak.navigationPath as SourceNavigationStep[] | null | undefined}
          />
          <Link href="/outbreaks" className="button-link secondary">
            返回疫情列表
          </Link>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>事件概览</h2>
            <p className="section-lead">先看关键字段，再决定是否需要进一步进入官方原始通报。</p>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-list">
            <div className="detail-item">
              <strong>病原</strong>
              {outbreak.pathogen.chineseName} / {outbreak.pathogen.code}
            </div>
            <div className="detail-item">
              <strong>来源系统</strong>
              {formatSourceSystem(outbreak.sourceSystem)}
            </div>
            <div className="detail-item">
              <strong>来源类型</strong>
              {formatSourceType(outbreak.sourceType)}
            </div>
            <div className="detail-item">
              <strong>事件范围</strong>
              {formatScope(outbreak.scope)}
            </div>
            <div className="detail-item">
              <strong>报告日期</strong>
              {formatDisplayDate(outbreak.reportDate)}
            </div>
            <div className="detail-item">
              <strong>事件日期</strong>
              {formatValue(outbreak.eventDateRaw)}
            </div>
            <div className="detail-item">
              <strong>国家 / 区域</strong>
              {formatLocation(outbreak.country, outbreak.region)}
            </div>
            <div className="detail-item">
              <strong>宿主 / 物种</strong>
              {formatValue(outbreak.hostSpecies)}
            </div>
            <div className="detail-item">
              <strong>病例数</strong>
              {outbreak.caseCount ?? "待补充"}
            </div>
            <div className="detail-item">
              <strong>死亡数</strong>
              {outbreak.deathCount ?? "待补充"}
            </div>
          </div>

          <div className="detail-item">
            <strong>阅读提示</strong>
            如果你需要确认事件原文、报告格式或上下文描述，可以使用上方来源链路按钮跳转到官方页面继续核对。
          </div>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>{summaryFromFallback ? "官方原文摘录" : "事件摘要"}</h2>
            <p className="section-lead">
              {summaryFromFallback
                ? "原始摘要信息过弱，以下自动回退为官方文档摘录，帮助用户补充理解事件重点。"
                : "以下摘要用于帮助用户快速理解事件重点。"}
            </p>
          </div>
        </div>
        <div className="detail-item detail-item--full">{displaySummary}</div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>原始记录</h2>
            <p className="section-lead">以下内容主要用于技术核对和字段排查，普通用户通常不需要展开。</p>
          </div>
        </div>
        <details className="technical-details">
          <summary>查看原始 JSON 数据</summary>
          <pre className="code-block">{JSON.stringify(outbreak.rawPayload, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
