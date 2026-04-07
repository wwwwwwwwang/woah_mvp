import Link from "next/link";

import { SyncConsole } from "@/app/admin/sync/sync-console";
import { prisma } from "@/lib/db";
import {
  formatDisplayDate,
  formatSourceSystem,
  formatStatus,
  getDataListHref,
  getStatusClassName,
} from "@/lib/presentation";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const jobs = await prisma.syncJob.findMany({
    take: 12,
    orderBy: { startedAt: "desc" },
    include: {
      pathogen: true,
    },
  });

  return (
    <div className="page-grid">
      <section className="hero">
        <p className="eyebrow">内部管理页面</p>
        <h1>手动触发官方数据同步</h1>
        <p>供内部管理员选择来源和病原后执行一次抓取。同步会在后台执行，当前页面可实时查看状态和详细日志。</p>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>发起同步</h2>
            <p className="section-lead">适合在需要临时补数、验证来源或演示平台流程时手动执行，任务创建后会自动进入后台处理。</p>
          </div>
        </div>
        <SyncConsole />
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <h2>最近任务</h2>
            <p className="section-lead">用于查看最近的同步结果、抓取规模和异常信息。当前任务的详细过程请看上方实时日志。</p>
          </div>
          <span className="muted">{jobs.length} 条任务</span>
        </div>
        <div className="timeline">
          {jobs.map((job) => (
            <div className="timeline-item" key={job.id}>
              <div className="timeline-item__meta">
                <span>{formatSourceSystem(job.sourceSystem)}</span>
                <span>{job.pathogen?.chineseName ?? "未知病原"}</span>
                <span>{formatDisplayDate(job.startedAt, true)}</span>
              </div>
              <div className={getStatusClassName(job.status)}>{formatStatus(job.status)}</div>
              <div className="muted">
                抓取 {job.fetchedCount} 条，新增 {job.insertedCount} 条，更新 {job.updatedCount} 条。
              </div>
              {job.status === "SUCCESS" && job.pathogen?.code ? (
                <div className="card-actions">
                  <Link
                    href={getDataListHref(job.sourceSystem, job.pathogen.code) ?? "#"}
                    className="pill"
                  >
                    查看同步数据
                  </Link>
                </div>
              ) : null}
              {job.errorSummary ? <div className="status-failed">{job.errorSummary}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
