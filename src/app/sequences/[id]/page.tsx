import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceLinks } from "@/components/source-links";
import { formatDisplayDate, formatLocation, formatSourceSystem, formatValue } from "@/lib/presentation";
import { getSequenceDetail } from "@/lib/queries";
import type { SourceNavigationStep } from "@/lib/types";

export const dynamic = "force-dynamic";

type SequenceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SequenceDetailPage({ params }: SequenceDetailPageProps) {
  const { id } = await params;
  const sequence = await getSequenceDetail(id);

  if (!sequence) {
    notFound();
  }

  return (
    <div className="page-grid">
      <section className="hero">
        <p className="eyebrow">{formatSourceSystem(sequence.sourceSystem)}</p>
        <h1>{sequence.accession}</h1>
        <p>{sequence.title}</p>
        <div className="badge-row">
          <span className="badge">病原: {sequence.pathogen.chineseName}</span>
          <span className="badge">年份: {sequence.collectionYear ?? "待补充"}</span>
          <span className="badge">地点: {formatLocation(sequence.country, sequence.region)}</span>
          <span className="badge">宿主: {sequence.host ?? "待补充"}</span>
          {sequence.strainOrSubtype ? <span className="badge">株系/亚型: {sequence.strainOrSubtype}</span> : null}
        </div>
        <div className="hero-actions">
          <SourceLinks
            sourceUrl={sequence.sourceUrl}
            sourceListUrl={sequence.sourceListUrl}
            sourceDetailUrl={sequence.sourceDetailUrl}
            navigationPath={sequence.navigationPath as SourceNavigationStep[] | null | undefined}
          />
          <Link href="/sequences" className="button-link secondary">
            返回序列列表
          </Link>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>关键信息</h2>
            <p className="section-lead">用于快速判断这条序列来自哪里、何时采样、对应什么宿主。</p>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-list">
            <div className="detail-item">
              <strong>病原</strong>
              {sequence.pathogen.chineseName} / {sequence.pathogen.code}
            </div>
            <div className="detail-item">
              <strong>来源系统</strong>
              {formatSourceSystem(sequence.sourceSystem)}
            </div>
            <div className="detail-item">
              <strong>记录标题</strong>
              {sequence.title}
            </div>
            <div className="detail-item">
              <strong>采样年份</strong>
              {sequence.collectionYear ?? "待补充"}
            </div>
            <div className="detail-item">
              <strong>原始日期</strong>
              {formatValue(sequence.collectionDateRaw)}
            </div>
            <div className="detail-item">
              <strong>国家 / 区域</strong>
              {formatLocation(sequence.country, sequence.region)}
            </div>
            <div className="detail-item">
              <strong>宿主</strong>
              {formatValue(sequence.host)}
            </div>
            <div className="detail-item">
              <strong>株系 / 亚型</strong>
              {formatValue(sequence.strainOrSubtype)}
            </div>
            <div className="detail-item">
              <strong>最近更新时间</strong>
              {formatDisplayDate(sequence.updatedAt, true)}
            </div>
          </div>

          <div className="detail-item">
            <strong>查看说明</strong>
            这条记录来自官方序列库，建议结合上方“来源入口页 / 详情页 / 原始文档”按钮继续核对原始信息。
          </div>
        </div>
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
          <pre className="code-block">{JSON.stringify(sequence.rawPayload, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
