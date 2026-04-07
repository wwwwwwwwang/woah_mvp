import Link from "next/link";

import { PATHOGEN_CATALOG } from "@/lib/constants/pathogens";
import {
  buildOutbreakSignalText,
  formatDisplayDate,
  formatLocation,
  formatScope,
  formatSourceSystem,
  getOutbreakDisplaySummary,
  getOutbreakSignalTone,
  summarizeText,
} from "@/lib/presentation";
import { listOutbreaks } from "@/lib/queries";

export const dynamic = "force-dynamic";

type OutbreaksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type OutbreakListItem = Awaited<ReturnType<typeof listOutbreaks>>[number];

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getPriorityScore(outbreak: OutbreakListItem) {
  const timeScore = outbreak.reportDate ? new Date(outbreak.reportDate).getTime() / 10_000_000_000 : 0;
  const deathScore = (outbreak.deathCount ?? 0) * 10 + ((outbreak.deathCount ?? 0) > 0 ? 500 : 0);
  const caseScore = (outbreak.caseCount ?? 0) + ((outbreak.caseCount ?? 0) > 0 ? 100 : 0);

  return timeScore + deathScore + caseScore;
}

export default async function OutbreaksPage({ searchParams }: OutbreaksPageProps) {
  const params = await searchParams;
  const outbreaks = await listOutbreaks(params);
  const selectedValues = ["pathogen", "sourceSystem", "scope", "country", "from", "to"].some((key) =>
    Boolean(getSingleValue(params[key])),
  );
  const countryCount = new Set(outbreaks.map((outbreak) => outbreak.country).filter(Boolean)).size;
  const humanCount = outbreaks.filter((outbreak) => outbreak.scope === "human").length;
  const animalCount = outbreaks.filter((outbreak) => outbreak.scope === "animal").length;
  const sourceCount = new Set(outbreaks.map((outbreak) => outbreak.sourceSystem)).size;
  const quantifiedCount = outbreaks.filter(
    (outbreak) => outbreak.caseCount !== null || outbreak.deathCount !== null,
  ).length;
  const latestReportDate = outbreaks.find((outbreak) => outbreak.reportDate)?.reportDate ?? null;
  const featuredOutbreaks = [...outbreaks].sort((left, right) => getPriorityScore(right) - getPriorityScore(left)).slice(0, 3);

  return (
    <div className="page-grid">
      <section className="hero">
        <p className="eyebrow">疫情事件检索</p>
        <h1>集中查看官方疫情通报和监测信息</h1>
        <p>
          这里整合展示 WHO、WOAH 和中国疾控的官方疫情事件，适合从病原、来源、时间和地点几个维度快速判断当前重点风险，
          并继续追溯到原始通报页面或文档。
        </p>
        <div className="badge-row">
          <span className="badge">当前结果 {outbreaks.length} 条</span>
          <span className="badge">涉及国家 {countryCount} 个</span>
          <span className="badge">来源覆盖 {sourceCount} 类</span>
          <span className="badge">人群事件 {humanCount} 条</span>
          <span className="badge">动物事件 {animalCount} 条</span>
          <span className="badge">可量化事件 {quantifiedCount} 条</span>
          <span className="badge">最近报告 {formatDisplayDate(latestReportDate)}</span>
        </div>
      </section>

      {featuredOutbreaks.length ? (
        <section className="card section-card">
          <div className="section-heading">
            <div>
              <h2>重点关注</h2>
              <p className="section-lead">结合时间、病例数和死亡数优先展示最值得先看的事件。</p>
            </div>
            {selectedValues ? (
              <Link href="/outbreaks" className="pill">
                恢复默认视图
              </Link>
            ) : null}
          </div>
          <div className="feature-grid">
            {featuredOutbreaks.map((outbreak) => {
              const tone = getOutbreakSignalTone(outbreak);
              const signalText = buildOutbreakSignalText(outbreak);

              return (
                <article key={outbreak.id} className={`feature-card feature-card--${tone}`}>
                  <div className="feature-card__meta">
                    <span>{formatSourceSystem(outbreak.sourceSystem)}</span>
                    <span>{formatDisplayDate(outbreak.reportDate)}</span>
                  </div>
                  <h3>{outbreak.title}</h3>
                  <p className={`record-card__signal record-card__signal--${tone}`}>{signalText}</p>
                  <p className="feature-card__summary">
                    {summarizeText(getOutbreakDisplaySummary(outbreak.summary, outbreak.rawPayload), 160)}
                  </p>
                  <div className="badge-row">
                    <span className="badge">病原: {outbreak.pathogen.chineseName}</span>
                    <span className="badge">范围: {formatScope(outbreak.scope)}</span>
                    <span className="badge">地点: {formatLocation(outbreak.country, outbreak.region)}</span>
                  </div>
                  <div className="card-actions">
                    <Link href={`/outbreaks/${outbreak.id}`} className="pill">
                      查看详情
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>筛选条件</h2>
            <p className="section-lead">适合按来源、时间区间和人群/动物范围逐步缩小查看范围。</p>
          </div>
          {selectedValues ? (
            <Link href="/outbreaks" className="pill">
              清空筛选
            </Link>
          ) : (
            <span className="muted">来源: WHO / WOAH / China CDC</span>
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
            <label htmlFor="sourceSystem">来源</label>
            <select id="sourceSystem" name="sourceSystem" defaultValue={getSingleValue(params.sourceSystem) ?? ""}>
              <option value="">全部</option>
              <option value="WHO">WHO</option>
              <option value="WOAH">WOAH</option>
              <option value="CHINACDC">China CDC</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="scope">事件范围</label>
            <select id="scope" name="scope" defaultValue={getSingleValue(params.scope) ?? ""}>
              <option value="">全部</option>
              <option value="human">人群事件</option>
              <option value="animal">动物事件</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="country">国家</label>
            <input id="country" name="country" defaultValue={getSingleValue(params.country) ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="from">开始日期</label>
            <input id="from" type="date" name="from" defaultValue={getSingleValue(params.from) ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="to">结束日期</label>
            <input id="to" type="date" name="to" defaultValue={getSingleValue(params.to) ?? ""} />
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
            <p className="section-lead">先查看信号和摘要，再进入详情页查看病例信息和官方来源链路。</p>
          </div>
          <span className="muted">共 {outbreaks.length} 条记录</span>
        </div>
        {outbreaks.length ? (
          <div className="results-list">
            {outbreaks.map((outbreak) => {
              const tone = getOutbreakSignalTone(outbreak);
              const signalText = buildOutbreakSignalText(outbreak);

              return (
                <article key={outbreak.id} className={`card record-card record-card--${tone}`}>
                  <div className="record-card__header">
                    <div className="record-card__main">
                      <p className="eyebrow">{formatSourceSystem(outbreak.sourceSystem)}</p>
                      <h3>{outbreak.title}</h3>
                      <p className={`record-card__signal record-card__signal--${tone}`}>{signalText}</p>
                      <p className="record-card__summary">
                        {summarizeText(getOutbreakDisplaySummary(outbreak.summary, outbreak.rawPayload), 180)}
                      </p>
                    </div>
                    <Link href={`/outbreaks/${outbreak.id}`} className="detail-link">
                      查看详情
                    </Link>
                  </div>
                  <div className="badge-row">
                    <span className="badge">病原: {outbreak.pathogen.chineseName}</span>
                    <span className="badge">范围: {formatScope(outbreak.scope)}</span>
                    <span className="badge">报告日期: {formatDisplayDate(outbreak.reportDate)}</span>
                    <span className="badge">地点: {formatLocation(outbreak.country, outbreak.region)}</span>
                    {outbreak.hostSpecies ? <span className="badge">对象: {outbreak.hostSpecies}</span> : null}
                    {outbreak.caseCount !== null && outbreak.caseCount !== undefined ? (
                      <span className="badge">病例: {outbreak.caseCount}</span>
                    ) : null}
                    {outbreak.deathCount !== null && outbreak.deathCount !== undefined ? (
                      <span className="badge">死亡: {outbreak.deathCount}</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>没有找到符合条件的疫情记录</h3>
            <p>可以尝试调整病原、来源、时间区间或国家条件后重新检索。</p>
          </div>
        )}
      </section>
    </div>
  );
}
