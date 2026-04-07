import Link from "next/link";

import {
  DistributionBarChart,
  ScopeDonutChart,
  TrendChart,
  WorldHeatMap,
} from "@/components/visualization/charts";
import { formatDisplayDate, formatSourceSystem } from "@/lib/presentation";
import {
  getVisualizationData,
  getVisualizationFilterOptions,
  getVisualizationTitle,
  parseVisualizationFilters,
} from "@/lib/visualization";

export const dynamic = "force-dynamic";

type VisualizationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VisualizationPage({ searchParams }: VisualizationPageProps) {
  const params = await searchParams;
  const filters = parseVisualizationFilters(params);
  const snapshot = await getVisualizationData(filters);
  const options = getVisualizationFilterOptions();
  const title = getVisualizationTitle(filters);
  const hasActiveFilters = Boolean(filters.pathogenCode || filters.sourceSystem || filters.scope || filters.window !== "90");

  return (
    <div className="page-grid visualization-page">
      <section className="hero visualization-hero">
        <p className="eyebrow">全球疫情态势驾驶舱</p>
        <h1>{title}</h1>
        <p>
          以官方疫情事件为主、序列信息为辅，聚合展示国家热力分布、时间趋势和重点来源变化。
          支持按病原、来源、范围和时间窗口筛选，并可直接钻取到现有检索页面继续分析。
        </p>
        <div className="badge-row">
          <span className="badge">时间窗口: {snapshot.windowLabel}</span>
          <span className="badge">疫情事件: {snapshot.kpis.outbreakCount}</span>
          <span className="badge">覆盖国家: {snapshot.kpis.countryCount}</span>
          <span className="badge">
            最近成功同步: {snapshot.lastSuccessfulSyncAt ? formatDisplayDate(snapshot.lastSuccessfulSyncAt, true) : "待补充"}
          </span>
        </div>
        <div className="hero-actions">
          <Link href="/outbreaks" className="button-link">
            查看疫情检索
          </Link>
          <Link href="/sequences" className="button-link secondary">
            查看序列检索
          </Link>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>筛选控制台</h2>
            <p className="section-lead">默认展示近 90 天疫情态势，可按病原、官方来源和事件范围快速切换视角。</p>
          </div>
          {hasActiveFilters ? (
            <Link href="/visualization" className="pill">
              恢复默认视图
            </Link>
          ) : (
            <span className="muted">地图热力按国家聚合，不展示单事件点位</span>
          )}
        </div>
        <form className="filters" method="get">
          <div className="field">
            <label htmlFor="visual-pathogen">病原</label>
            <select id="visual-pathogen" name="pathogen" defaultValue={filters.pathogenCode ?? ""}>
              <option value="">全部病原</option>
              {options.pathogens.map((pathogen) => (
                <option key={pathogen.code} value={pathogen.code}>
                  {pathogen.chineseName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="visual-source">来源</label>
            <select id="visual-source" name="sourceSystem" defaultValue={filters.sourceSystem ?? ""}>
              <option value="">全部来源</option>
              {options.sources.map((source) => (
                <option key={source} value={source}>
                  {formatSourceSystem(source)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="visual-scope">事件范围</label>
            <select id="visual-scope" name="scope" defaultValue={filters.scope ?? ""}>
              <option value="">全部范围</option>
              {options.scopes.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="visual-window">时间窗口</label>
            <select id="visual-window" name="window" defaultValue={filters.window}>
              {options.windows.map((windowOption) => (
                <option key={windowOption.value} value={windowOption.value}>
                  {windowOption.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="visual-submit">刷新视图</label>
            <button id="visual-submit" type="submit" className="button">
              更新态势页
            </button>
          </div>
        </form>
      </section>

      <section className="visual-kpi-grid">
        <article className="card visual-kpi-card">
          <span>疫情事件</span>
          <strong>{snapshot.kpis.outbreakCount}</strong>
          <p>当前筛选结果中的官方疫情事件总数</p>
        </article>
        <article className="card visual-kpi-card">
          <span>覆盖国家</span>
          <strong>{snapshot.kpis.countryCount}</strong>
          <p>涉及国家或地区数量，用于判断外溢范围</p>
        </article>
        <article className="card visual-kpi-card">
          <span>病例数</span>
          <strong>{snapshot.kpis.caseCount}</strong>
          <p>基于已结构化事件字段汇总</p>
        </article>
        <article className="card visual-kpi-card">
          <span>死亡数</span>
          <strong>{snapshot.kpis.deathCount}</strong>
          <p>用于快速判断事件严重程度</p>
        </article>
        <article className="card visual-kpi-card">
          <span>人群 / 动物</span>
          <strong>
            {snapshot.kpis.humanCount} / {snapshot.kpis.animalCount}
          </strong>
          <p>区分公共卫生事件和动物疫情范围</p>
        </article>
        <article className="card visual-kpi-card">
          <span>序列辅助</span>
          <strong>{snapshot.sequenceInsights.totalCount}</strong>
          <p>当前病原条件下的序列记录总量</p>
        </article>
      </section>

      <section>
        <article className="card section-card visual-panel visual-panel--map">
          <div className="section-heading">
            <div>
              <h2>国家热力分布</h2>
              <p className="section-lead">按国家聚合当前筛选条件下的疫情事件强度，点击可直接钻取到疫情列表页。</p>
            </div>
            <span className="pill">主视觉</span>
          </div>
          <WorldHeatMap data={snapshot.mapData} />
        </article>

      </section>

      <section className="visual-secondary-grid">
          <article className="card section-card visual-panel visual-panel--stacked">
            <div className="section-heading">
              <div>
                <h2>重点国家排行</h2>
                <p className="section-lead">综合事件量、病例数和死亡数，优先展示当前最值得关注的国家。</p>
              </div>
              <span className="muted">Top {snapshot.countryRanking.length}</span>
            </div>
            {snapshot.countryRanking.length ? (
              <div className="viz-rank-list">
                {snapshot.countryRanking.map((country, index) => (
                  <Link key={`${country.mapId}-${country.country}`} href={country.href} className="viz-rank-item">
                    <span className="viz-rank-item__index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="viz-rank-item__body">
                      <strong>{country.country}</strong>
                      <p>
                        事件 {country.outbreakCount} 条 · 病例 {country.caseCount} 例 · 死亡 {country.deathCount} 例
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>暂无可排行国家</h3>
                <p>当前筛选结果为空，地图和国家排行会在同步后自动更新。</p>
              </div>
            )}
          </article>

          <article className="card section-card visual-panel visual-panel--stacked">
            <div className="section-heading">
              <div>
                <h2>最新官方通报</h2>
                <p className="section-lead">保留最新事件入口，便于从态势页快速回到具体通报详情。</p>
              </div>
              <span className="muted">{snapshot.latestOutbreaks.length} 条</span>
            </div>
            {snapshot.latestOutbreaks.length ? (
              <div className="viz-live-list">
                {snapshot.latestOutbreaks.map((outbreak) => (
                  <Link key={outbreak.id} href={outbreak.href} className="viz-live-item">
                    <div className="viz-live-item__meta">
                      <span>{outbreak.pathogenName}</span>
                      <span>{formatSourceSystem(outbreak.sourceSystem)}</span>
                    </div>
                    <strong>{outbreak.title}</strong>
                    <p>{outbreak.signalSummary}</p>
                    <div className="badge-row">
                      <span className="badge">日期: {formatDisplayDate(outbreak.reportDate)}</span>
                      <span className="badge">地点: {outbreak.country ?? "待补充"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>暂无最新通报</h3>
                <p>当前筛选条件下没有可展示的最新事件，可尝试切换病原或时间窗口。</p>
              </div>
            )}
          </article>
      </section>

      <section className="visual-chart-grid">
        <article className="card section-card visual-panel visual-panel--wide">
          <div className="section-heading">
            <div>
              <h2>时间趋势</h2>
              <p className="section-lead">
                近 30/90 天按周聚合，全部历史按月聚合；点击趋势节点可跳到对应时间段的疫情列表。
              </p>
            </div>
          </div>
          <TrendChart data={snapshot.trendData} />
        </article>

        <article className="card section-card visual-panel">
          <div className="section-heading">
            <div>
              <h2>病原分布</h2>
              <p className="section-lead">当前筛选结果中的病原事件占比，可继续按病原钻取。</p>
            </div>
          </div>
          <DistributionBarChart data={snapshot.pathogenDistribution} />
        </article>

        <article className="card section-card visual-panel">
          <div className="section-heading">
            <div>
              <h2>来源分布</h2>
              <p className="section-lead">比较 WHO、WOAH 和中国疾控数据在当前视图中的占比。</p>
            </div>
          </div>
          <DistributionBarChart data={snapshot.sourceDistribution} />
        </article>

        <article className="card section-card visual-panel">
          <div className="section-heading">
            <div>
              <h2>范围分布</h2>
              <p className="section-lead">快速判断当前态势更偏公共卫生事件，还是偏动物疫情监测。</p>
            </div>
          </div>
          <ScopeDonutChart data={snapshot.scopeDistribution} />
        </article>
      </section>

      <section className="card section-card visual-panel">
        <div className="section-heading">
          <div>
            <h2>序列辅助视图</h2>
            <p className="section-lead">
              作为疫情态势的补充，仅跟随病原筛选，不跟随来源、范围和时间窗口变化。
            </p>
          </div>
          <Link href="/sequences" className="pill">
            查看全部序列
          </Link>
        </div>

        <div className="visual-sequence-grid">
          <article className="card visual-kpi-card visual-kpi-card--soft">
            <span>序列总量</span>
            <strong>{snapshot.sequenceInsights.totalCount}</strong>
            <p>用于辅助判断该病原的序列沉淀程度</p>
          </article>

          <article className="card section-card visual-panel">
            <div className="section-heading">
              <div>
                <h2>序列病原分布</h2>
                <p className="section-lead">点击图表可切换到对应病原的序列列表。</p>
              </div>
            </div>
            <DistributionBarChart data={snapshot.sequenceInsights.pathogenDistribution} height={240} />
          </article>

          <article className="card section-card visual-panel">
            <div className="section-heading">
              <div>
                <h2>序列国家排行</h2>
                <p className="section-lead">展示当前病原条件下序列来源较多的国家。</p>
              </div>
            </div>
            {snapshot.sequenceInsights.countryRanking.length ? (
              <div className="viz-rank-list">
                {snapshot.sequenceInsights.countryRanking.map((country, index) => (
                  <Link key={`${country.country}-${country.count}`} href={country.href} className="viz-rank-item">
                    <span className="viz-rank-item__index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="viz-rank-item__body">
                      <strong>{country.country}</strong>
                      <p>序列记录 {country.count} 条</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>暂无序列排行</h3>
                <p>当前病原条件下没有可展示的序列国家排行。</p>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
