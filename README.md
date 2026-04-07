# 病原情报平台 MVP

一个面向官方数据源的病原情报平台最小可用版本，聚焦多源抓取、标准化入库、手动同步与检索展示。

当前版本固定支持 4 个病原，覆盖基因组序列、官方疫情通报和官方监测资料，保留真实来源页面与抓取链路，便于后续升级为正式版时继续复用采集与标准化流程。

## 项目目标

- 固定病原范围，先做可跑通的 MVP 闭环。
- 只接官方来源，不接媒体报道。
- 支持手动触发同步，不做定时任务。
- 数据先入本项目数据库，前台提供检索列表与详情页。
- 保留来源链路，确保每条记录都能回溯到真实入口页、列表页、详情页或原始文档。

## 当前支持的病原

| 代码 | 中文名 | 英文名 | 说明 |
| --- | --- | --- | --- |
| `NIPAH` | 尼帕病毒性脑炎 | `Nipah virus` | 人感染疫情 + 序列 |
| `H5N1` | 高致病性禽流感（MVP 按 H5N1 实现） | `Highly pathogenic avian influenza H5N1` | 人感染/动物疫情 + 序列 |
| `RVF` | 裂谷热 | `Rift Valley fever virus` | 疫情 + 序列 |
| `XHFV` | 新疆出血热 | `Xinjiang hemorrhagic fever virus` | 疫情 + 序列 |

## 当前支持的数据源

| 来源 | 覆盖内容 | 真实抓取流程 |
| --- | --- | --- |
| `NCBI` | 基因组序列 | NCBI 检索接口 -> `efetch`/GenBank 数据 -> `nuccore` 详情链接 |
| `WHO` | Disease Outbreak News 人类疫情通报 | DON 列表页 -> DON feed API -> 文章详情页 |
| `WOAH` | WAHIS 动物疫情 | WAHIS 公共入口页 -> `filtered-list` 公共接口 -> 官方 `review-pdf` |
| `CHINACDC` | 中国疾控精选监测栏目/PDF | 栏目列表页 -> 详情页或 PDF -> PDF 文本解析 |

## China CDC 与 WOAH 的真实流程说明

这个项目特别强调“抓取真实入口与真实页面”，不是只保存一个最终 PDF 或说明页链接。

### WOAH

- 入口页：`https://wahis.woah.org/#/event-management`
- 列表接口：`POST /api/v1/pi/event/filtered-list?language=EN`
- 原始文档：`/api/v1/pi/pdf-generation/report/{reportId}/review-pdf?language=EN`

MVP 当前优先采用 WAHIS 公共列表接口与官方 PDF 原文，保证流程真实、结构稳定、可追溯。

### China CDC

当前接入两类真实栏目：

- `jksj03`：列表页 -> PDF
- `jksj04_14249`：列表页 -> 详情页 -> PDF

这意味着系统保存的不只是文档 URL，还会记录它来自哪个栏目页、是否经过详情页、最终落到哪个 PDF。

## 核心能力

- 固定 4 个病原字典，维护中英文名、别名与多来源查询词。
- 按来源拆分采集适配器，便于后续独立拆成采集服务。
- 统一标准化字段，包括病原、来源、地点、宿主、日期、病例/死亡数、摘要等。
- 保存 `sourceListUrl`、`sourceDetailUrl`、`navigationPath`，用于展示真实来源链路。
- 支持同步任务日志，记录抓取数、新增数、更新数和错误摘要。
- 前台提供总览页、序列检索、疫情检索和详情页。

## 技术栈

- `Next.js 16` + `App Router`
- `TypeScript`
- `Prisma 7`
- `SQLite`
- `@prisma/adapter-libsql`
- `Cheerio`
- `pdf-parse`
- `Zod`
- `Vitest`

## 目录结构

```text
.
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ scripts/
│  └─ smoke-sync.ts
├─ src/
│  ├─ app/
│  │  ├─ admin/sync
│  │  ├─ api
│  │  ├─ outbreaks
│  │  └─ sequences
│  └─ lib/
│     ├─ constants
│     ├─ sources
│     ├─ utils
│     ├─ queries.ts
│     └─ sync.ts
└─ .env.example
```

## 数据模型

项目当前包含 5 个核心模型：

- `Pathogen`：病原字典。
- `SequenceRecord`：序列记录，包含分离年份、地点、宿主、来源链接、原始 payload。
- `OutbreakEvent`：疫情事件，包含来源系统、范围、人/动物、日期、地点、病例/死亡数、摘要与来源链路。
- `SyncJob`：同步任务日志。
- `RawDocument`：原始页面/PDF 留痕，用于追溯与后续再解析。

其中 `SequenceRecord`、`OutbreakEvent`、`RawDocument` 都保存了以下链路字段：

- `sourceUrl`
- `sourceListUrl`
- `sourceDetailUrl`
- `navigationPath`

这套字段就是后续正式版继续复用采集流程的关键。

## 页面与使用场景

本项目的数据展示页面主要面向业务用户、分析人员和管理人员，目标不是展示技术细节，而是帮助用户快速了解病原态势、检索重点信息并追溯官方来源。

### 用户页面

| 页面 | 路径 | 用户能做什么 | 展示重点 |
| --- | --- | --- | --- |
| 首页 | `/` | 快速了解平台当前收录情况与最近同步结果 | 病原卡片、序列总量、疫情总量、最近同步任务 |
| 序列检索 | `/sequences` | 按病原、年份、国家、宿主快速筛选目标序列 | 可筛选列表、关键元数据、结果概览 |
| 序列详情 | `/sequences/[id]` | 查看单条序列的核心信息并回溯官方来源 | 分离年份、地点、宿主、原始字段、来源链路 |
| 疫情检索 | `/outbreaks` | 检索不同病原、不同来源和不同时间范围内的疫情事件 | 来源筛选、时间筛选、国家筛选、人/动物范围筛选 |
| 疫情详情 | `/outbreaks/[id]` | 查看事件摘要、病例信息与官方原始出处 | 标准化字段、摘要、病例/死亡数、来源链路 |

### 内部管理页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 手动同步 | `/admin/sync` | 供内部运营或管理员手动触发抓取、查看同步状态与任务日志，不属于普通用户的数据浏览页面 |

## API

以下接口主要用于系统联调、内部集成和后续服务拆分，普通用户通常通过页面完成查询与浏览，不需要直接调用这些接口。

### `POST /api/admin/sync`

手动触发一次同步。

请求体示例：

```json
{
  "sourceSystem": "WHO",
  "pathogenCode": "NIPAH"
}
```

支持值：

- `sourceSystem`: `NCBI` | `WHO` | `WOAH` | `CHINACDC`
- `pathogenCode`: `NIPAH` | `H5N1` | `RVF` | `XHFV`

### `GET /api/sequences`

支持查询参数：

- `pathogen`
- `year`
- `country`
- `host`

示例：

```bash
curl "http://localhost:3000/api/sequences?pathogen=NIPAH&year=2024"
```

### `GET /api/sequences/[id]`

按记录 ID 获取单条序列详情。

### `GET /api/outbreaks`

支持查询参数：

- `pathogen`
- `sourceSystem`
- `scope`
- `country`
- `from`
- `to`

示例：

```bash
curl "http://localhost:3000/api/outbreaks?pathogen=H5N1&sourceSystem=WOAH&scope=animal"
```

### `GET /api/outbreaks/[id]`

按记录 ID 获取单条疫情详情。

## 本地启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`。

推荐初始配置：

```env
DATABASE_URL="file:./dev.db"
SYNC_RECORD_LIMIT="25"
NCBI_API_KEY=""
APP_BASE_URL="http://localhost:3000"
```

变量说明：

| 变量名 | 说明 |
| --- | --- |
| `DATABASE_URL` | 本地 SQLite 数据库地址 |
| `SYNC_RECORD_LIMIT` | 单次同步每个来源最多处理的记录数 |
| `NCBI_API_KEY` | 可选，配置后可提升 NCBI 请求限额 |
| `APP_BASE_URL` | 当前应用访问地址 |

### 3. 初始化数据库

```bash
pnpm prisma:generate
pnpm db:push
pnpm db:seed
```

### 4. 启动开发服务器

```bash
pnpm dev
```

打开 `http://localhost:3000` 即可访问。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务器，默认访问地址为 `http://localhost:3000` |
| `pnpm build` | 构建生产版本，用于发布前检查编译是否通过 |
| `pnpm start` | 启动已构建的生产服务，通常配合 `pnpm build` 使用 |
| `pnpm lint` | 执行 ESLint 检查，发现代码风格与潜在问题 |
| `pnpm test` | 运行 Vitest 测试并输出覆盖率 |
| `pnpm prisma:generate` | 根据 Prisma Schema 生成客户端代码 |
| `pnpm db:push` | 将当前 Prisma Schema 同步到本地 SQLite 数据库 |
| `pnpm db:seed` | 初始化病原字典等基础数据 |
| `pnpm run sync:run WHO NIPAH` | 通过脚本手动触发一次同步，示例为 `WHO + NIPAH` |

## 手动同步方式

### 方式一：通过页面触发

打开 `/admin/sync`，选择来源与病原后发起同步。

### 方式二：通过脚本触发

```bash
pnpm run sync:run WHO NIPAH
pnpm run sync:run NCBI NIPAH
pnpm run sync:run WOAH H5N1
pnpm run sync:run CHINACDC H5N1
```

该脚本会输出本次同步任务的 `status`、`fetchedCount`、`insertedCount`、`updatedCount` 等信息。

## 已验证内容

当前项目已完成以下验证：

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm run sync:run WHO NIPAH`
- `pnpm run sync:run NCBI NIPAH`
- `pnpm run sync:run WOAH H5N1`
- `pnpm run sync:run CHINACDC H5N1`

## 当前边界

- 只覆盖官方结构化来源，不抓取媒体报道。
- 只支持手动同步，不包含定时任务。
- 默认面向内部使用，不包含完整权限系统。
- 暂不做跨来源事件合并，WHO 与 WOAH 即使描述同一波事件也分别存储。
- China CDC 当前是“精选栏目定向解析”，不是全站通用爬虫。
- WOAH 当前优先保存真实 WAHIS 列表入口和官方 `review-pdf` 原文，部分更细粒度接口后续可再增强。

## 升级到正式版时的建议

- 优先把 `src/lib/sources` 与标准化逻辑抽成独立采集服务。
- 数据库从 SQLite 切换到 PostgreSQL。
- 保留现有字段设计，尤其是来源链路字段，避免正式版重做采集模型。
- 前端可以继续使用 Next.js，也可以在保留 API 设计的前提下迁移到 `Vue 3 + Spring Boot`。

## 说明

构建或同步过程中如果出现 `punycode` 相关弃用警告，当前观察为非阻塞告警，不影响本项目 MVP 的运行与数据落库。
