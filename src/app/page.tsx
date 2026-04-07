import Link from "next/link";

import {
  buildOutbreakSignalText,
  formatDisplayDate,
  formatLocation,
  formatSourceSystem,
  formatStatus,
  getOutbreakDisplaySummary,
  getOutbreakSignalTone,
  getStatusClassName,
  summarizeText,
} from "@/lib/presentation";
import { getDashboardData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboard = await getDashboardData();
  const sourceCount = 4;

  return (
    <div className="page-grid">
      <section className="hero">
        <p className="eyebrow">官方病原信息整合平台</p>
        <h1>让病原序列和官方疫情信息更快被看见</h1>
        <p>
          围绕尼帕病毒、H5N1、裂谷热和新疆出血热，集中展示来自 NCBI、WHO、WOAH 和中国疾控的官方数据。
          用户可以在这里快速查看疫情动态、定位序列记录，并回溯到真实官方来源。
        </p>
        <div className="badge-row">
          <span className="badge">支持 4 个重点病原</span>
          <span className="badge">覆盖 4 类官方来源</span>
          <span className="badge">支持来源追溯</span>
        </div>
        <div className="hero-actions">
          <Link href="/outbreaks" className="button-link">
            查看疫情动态
          </Link>
          <Link href="/visualization" className="button-link secondary">
            打开态势大屏
          </Link>
          <Link href="/sequences" className="button-link secondary">
            查看序列信息
          </Link>
        </div>
      </section>

      <section className="stats">
        <article className="stat-card">
          <div className="stat-card__label">重点病原</div>
          <div className="stat-card__value">{dashboard.pathogens.length}</div>
        </article>
        <article className="stat-card">
          <div className="stat-card__label">序列记录</div>
          <div className="stat-card__value">{dashboard.sequenceCount}</div>
        </article>
        <article className="stat-card">
          <div className="stat-card__label">疫情事件</div>
          <div className="stat-card__value">{dashboard.outbreakCount}</div>
        </article>
        <article className="stat-card">
          <div className="stat-card__label">官方来源</div>
          <div className="stat-card__value">{sourceCount}</div>
        </article>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>当前态势</h2>
            <p className="section-lead">先用 4 张摘要卡快速建立整体印象，再进入疫情或序列页面继续检索。</p>
          </div>
          <Link href="/outbreaks" className="pill">
            查看全部疫情
          </Link>
        </div>
        <div className="insight-grid">
          <article className="insight-card">
            <div className="insight-card__label">当前关注病原</div>
            <div className="insight-card__value">{dashboard.insights.topPathogen?.chineseName ?? "待补充"}</div>
            <p className="insight-card__subtext">
              {dashboard.insights.topPathogen
                ? `累计 ${dashboard.insights.topPathogen._count.outbreaks} 条疫情记录`
                : "暂时还没有形成可展示的重点病原"}
            </p>
          </article>
          <article className="insight-card">
            <div className="insight-card__label">最近官方通报</div>
            <div className="insight-card__value">
              {formatDisplayDate(dashboard.insights.latestOutbreak?.reportDate ?? null)}
            </div>
            <p className="insight-card__subtext">
              {dashboard.insights.latestOutbreak
                ? `${dashboard.insights.latestOutbreak.pathogen.chineseName} · ${formatSourceSystem(dashboard.insights.latestOutbreak.sourceSystem)}`
                : "暂时还没有可展示的官方通报"}
            </p>
          </article>
          <article className="insight-card">
            <div className="insight-card__label">覆盖国家 / 地区</div>
            <div className="insight-card__value">{dashboard.insights.outbreakCountryCount}</div>
            <p className="insight-card__subtext">基于已入库疫情事件统计，帮助快速判断覆盖广度。</p>
          </article>
          <article className="insight-card">
            <div className="insight-card__label">人群 / 动物事件</div>
            <div className="insight-card__value">
              {dashboard.insights.humanOutbreakCount} / {dashboard.insights.animalOutbreakCount}
            </div>
            <p className="insight-card__subtext">
              覆盖 {dashboard.insights.activeSourceCount} 类来源，便于区分研判范围。
            </p>
          </article>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>重点病原</h2>
            <p className="section-lead">按病原进入对应的序列和疫情页面，更适合围绕单个病原持续跟踪。</p>
          </div>
        </div>
        <div className="pathogen-grid">
          {dashboard.pathogens.map((pathogen) => (
            <article key={pathogen.id} className="card pathogen-card">
              <h3>{pathogen.chineseName}</h3>
              <p>{pathogen.englishName}</p>
              <div className="pathogen-meta">
                <span>代码: {pathogen.code}</span>
                <span>已收录序列: {pathogen._count.sequences}</span>
                <span>已收录疫情: {pathogen._count.outbreaks}</span>
              </div>
              <div className="card-actions">
                <Link href={`/sequences?pathogen=${pathogen.code}`} className="pill">
                  查看序列
                </Link>
                <Link href={`/outbreaks?pathogen=${pathogen.code}`} className="pill">
                  查看疫情
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="list-grid">
        <section className="card section-card">
          <div className="section-heading">
            <div>
              <h2>最新官方通报</h2>
              <p className="section-lead">优先展示最近入库的官方疫情事件，适合快速浏览近期重点。</p>
            </div>
            <Link href="/outbreaks" className="pill">
              浏览全部
            </Link>
          </div>
          {dashboard.recentOutbreaks.length ? (
            <div className="feature-grid">
              {dashboard.recentOutbreaks.map((outbreak) => {
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
                      {summarizeText(getOutbreakDisplaySummary(outbreak.summary, outbreak.rawPayload), 140)}
                    </p>
                    <div className="badge-row">
                      <span className="badge">病原: {outbreak.pathogen.chineseName}</span>
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
          ) : (
            <div className="empty-state">
              <h3>暂时还没有可展示的最新通报</h3>
              <p>当有新的官方疫情事件入库后，这里会优先展示最近的记录。</p>
            </div>
          )}
        </section>

        <section className="card section-card">
          <div className="section-heading">
            <div>
              <h2>最近可用更新</h2>
              <p className="section-lead">这里仅展示已经成功入库的数据更新，帮助用户判断当前页面信息的新鲜度。</p>
            </div>
            <span className="muted">最近 {dashboard.latestSyncs.length} 条成功更新</span>
          </div>
          {dashboard.latestSyncs.length ? (
            <div className="timeline">
              {dashboard.latestSyncs.map((job) => (
                <div className="timeline-item" key={job.id}>
                  <div className="timeline-item__meta">
                    <span>{formatSourceSystem(job.sourceSystem)}</span>
                    <span>{job.pathogen?.chineseName ?? "未知病原"}</span>
                    <span className={getStatusClassName(job.status)}>{formatStatus(job.status)}</span>
                  </div>
                  <div>{formatDisplayDate(job.startedAt, true)}</div>
                  <div className="muted">
                    本次抓取 {job.fetchedCount} 条，新增 {job.insertedCount} 条，更新 {job.updatedCount} 条。
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>暂时还没有成功入库的更新记录</h3>
              <p>可以稍后再查看，或由管理员进入数据同步页面执行一次同步。</p>
            </div>
          )}
        </section>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>常用入口</h2>
            <p className="section-lead">从最常见的分析任务出发，选择你要浏览的内容。</p>
          </div>
        </div>
        <div className="timeline">
          <Link href="/visualization" className="timeline-item">
            <strong>查看态势大屏</strong>
            <div className="muted">适合快速查看国家热力分布、时间趋势和重点国家排行，再继续钻取到检索页面。</div>
          </Link>
          <Link href="/sequences" className="timeline-item">
            <strong>查看序列信息</strong>
            <div className="muted">适合按病原、年份、国家和宿主快速定位 NCBI 官方序列记录。</div>
          </Link>
          <Link href="/outbreaks" className="timeline-item">
            <strong>查看疫情动态</strong>
            <div className="muted">适合查看 WHO、WOAH 和中国疾控的官方疫情事件与监测信息。</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
