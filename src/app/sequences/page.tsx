import Link from "next/link";

import { PATHOGEN_CATALOG } from "@/lib/constants/pathogens";
import { formatLocation, summarizeText } from "@/lib/presentation";
import { listSequences } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SequencesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SequencesPage({ searchParams }: SequencesPageProps) {
  const params = await searchParams;
  const sequences = await listSequences(params);
  const selectedValues = ["pathogen", "year", "country", "host"].some((key) => Boolean(getSingleValue(params[key])));
  const countryCount = new Set(sequences.map((sequence) => sequence.country).filter(Boolean)).size;
  const hostCount = new Set(sequences.map((sequence) => sequence.host).filter(Boolean)).size;
  const yearValues = sequences
    .map((sequence) => sequence.collectionYear)
    .filter((value): value is number => value !== null && value !== undefined);
  const yearRange = yearValues.length > 0 ? `${Math.min(...yearValues)} - ${Math.max(...yearValues)}` : "待补充";

  return (
    <div className="page-grid">
      <section className="hero">
        <p className="eyebrow">序列信息检索</p>
        <h1>按病原、地点和宿主快速定位官方序列记录</h1>
        <p>
          这里聚合展示来自 NCBI 的官方序列信息，适合用于查看不同病原在不同国家、年份和宿主中的采样分布，
          并支持跳转到原始来源页面继续核对。
        </p>
        <div className="badge-row">
          <span className="badge">当前结果 {sequences.length} 条</span>
          <span className="badge">涉及国家 {countryCount} 个</span>
          <span className="badge">涉及宿主 {hostCount} 类</span>
          <span className="badge">年份范围 {yearRange}</span>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>筛选条件</h2>
            <p className="section-lead">先缩小范围，再进入详情查看单条序列的来源与原始信息。</p>
          </div>
          {selectedValues ? (
            <Link href="/sequences" className="pill">
              清空筛选
            </Link>
          ) : (
            <span className="muted">来源: NCBI / nuccore</span>
          )}
        </div>
        <form className="filters" method="get">
          <div className="field">
            <label htmlFor="pathogen">病原</label>
            <select id="pathogen" name="pathogen" defaultValue={getSingleValue(params.pathogen) ?? ""}>
              <option value="">全部</option>
              {PATHOGEN_CATALOG.map((pathogen) => (
                <option key={pathogen.code} value={pathogen.code}>
                  {pathogen.chineseName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="year">年份</label>
            <input id="year" name="year" defaultValue={getSingleValue(params.year) ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="country">国家</label>
            <input id="country" name="country" defaultValue={getSingleValue(params.country) ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="host">宿主</label>
            <input id="host" name="host" defaultValue={getSingleValue(params.host) ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="submit">执行筛选</label>
            <button id="submit" type="submit" className="button">
              查看结果
            </button>
          </div>
        </form>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>结果列表</h2>
            <p className="section-lead">每条记录都可以进入详情页，继续查看地点、宿主、原始描述和官方来源。</p>
          </div>
          <span className="muted">共 {sequences.length} 条记录</span>
        </div>
        {sequences.length ? (
          <div className="results-list">
            {sequences.map((sequence) => (
              <article key={sequence.id} className="card record-card">
                <div className="record-card__header">
                  <div className="record-card__main">
                    <p className="eyebrow">{sequence.pathogen.chineseName}</p>
                    <h3>{sequence.accession}</h3>
                    <p className="record-card__summary">{summarizeText(sequence.title, 160)}</p>
                  </div>
                  <Link href={`/sequences/${sequence.id}`} className="detail-link">
                    查看详情
                  </Link>
                </div>
                <div className="badge-row">
                  <span className="badge">年份: {sequence.collectionYear ?? "待补充"}</span>
                  <span className="badge">地点: {formatLocation(sequence.country, sequence.region)}</span>
                  <span className="badge">宿主: {sequence.host ?? "待补充"}</span>
                  <span className="badge">来源: NCBI</span>
                  {sequence.strainOrSubtype ? <span className="badge">株系/亚型: {sequence.strainOrSubtype}</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>没有找到符合条件的序列记录</h3>
            <p>可以尝试放宽病原、年份、国家或宿主条件，再重新检索。</p>
          </div>
        )}
      </section>
    </div>
  );
}
