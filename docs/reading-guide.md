# 面向维护者的阅读指南

这份文档不是给外部访客看的 README，也不是实现细节清单。

它的目标很直接：

- 帮你这个有后端背景、但暂时不熟悉 Next.js / TypeScript / SQLite 前端式组织方式的人
- 在一周内分段阅读这个项目时，始终知道“现在看到哪一层、这一层解决什么问题、下一步该看哪里”
- 让这个项目从“AI 和你一起做出来的可运行产品”，逐步变成“你自己能看懂、能解释、能继续接手”的项目

---

## 1. 项目总览

Index Journal 当前是一个以“指数投资观察”为核心的个人站点。

它现在同时包含四类能力：

1. 市场面板
   - 首页展示 `SPY` / `QQQ` 的阶段表现、长期指标和图表
2. 补充观察页
   - `/forex` 展示汇率
   - `/btc` 展示 BTC
3. 手动快照机制
   - 在允许的时段里，用户可以主动刷新最近价格快照
4. 基金季报解析
   - `/cn-funds` 与 `/otc-funds` 支持按代码抓取、解析并保存最近季报

这个项目的核心特点不是“实时交易”，而是：

- 数据尽量落到本地 SQLite
- 页面展示尽量建立在本地数据和本地计算上
- 远程 API 主要负责“原始数据获取”
- 服务层负责“把原始数据整理成页面真正需要的结果”

---

## 2. 技术栈与协作方式

你可以把它粗略理解成：

- Web 框架：Next.js App Router
- 语言：TypeScript
- 数据库：SQLite
- ORM：Prisma
- 外部行情源：Twelve Data
- 基金季报源：中国证监会披露平台

对一个后端开发者来说，最重要的理解方式是：

- `app/` 更像“控制器 + 页面入口”
- `lib/` 更像“服务层 + 领域逻辑层”
- `prisma/schema.prisma` 更像“数据库结构定义”
- `scripts/` 更像“离线任务入口”

也就是说，这个项目虽然是全栈站点，但真正需要你长期理解的仍然是几条熟悉的链路：

- 页面请求如何进入服务层
- 服务层如何从 SQLite 读取数据
- 服务层如何做业务计算
- 脚本如何把远程数据写进 SQLite

---

## 3. 目录结构地图

### `app/`

页面和 API 入口层。

主要关注：

- 页面文件：`app/page.tsx`、`app/forex/page.tsx`、`app/btc/page.tsx`、`app/cn-funds/page.tsx`、`app/otc-funds/page.tsx`
- API route：`app/api/**/route.ts`
- 组件：`app/components/*`

你可以把这一层理解为：

- 页面层负责组织展示
- API 层负责把服务层结果包装成 JSON
- 复杂计算原则上不应该堆在这里

### `lib/`

项目最值得读的一层。

这里包含：

- 指数、汇率、BTC 的数据服务
- 手动快照逻辑
- 双轨同步逻辑
- 基金季报抓取与解析逻辑
- 共享格式化和指标计算函数
- Prisma 单例

如果你未来只花有限时间理解项目，这一层优先级最高。

### `scripts/`

离线同步任务入口。

主要负责：

- 拉取 Twelve Data 原始数据
- 写入 SQLite
- 记录同步 checkpoint

如果你想理解“数据库里的数据是怎么来的”，这里一定要看。

### `prisma/`

数据库结构定义。

最重要的是：

- `schema.prisma` 定义了 SQLite 里有哪些表
- 它决定了服务层能读写哪些数据

### `docs/`

维护文档层。

推荐用途：

- `architecture.md` 看整体架构
- `development.md` 看开发流程与排错
- `reading-guide.md` 看阅读路径和数据流

---

## 4. 推荐阅读路径

这部分是给你周一到周五分段阅读时用的。

### 第一步：先建立“这个项目在做什么”

按顺序看：

1. `README.md`
2. `AGENTS.md`
3. `docs/reading-guide.md`

目标：

- 知道项目定位
- 知道当前功能边界
- 知道这不是交易终端，而是个人观察工具

### 第二步：看页面入口，理解“页面要什么数据”

按顺序看：

1. `app/page.tsx`
2. `app/forex/page.tsx`
3. `app/btc/page.tsx`
4. `app/cn-funds/page.tsx`
5. `app/otc-funds/page.tsx`

目标：

- 先看页面需要展示哪些信息
- 不急着追实现，先记住页面依赖了哪些服务函数

你要重点留意页面里调用了哪些 `lib/*` 方法。

### 第三步：看首页与观察页的数据服务层

按顺序看：

1. `lib/index-data.ts`
2. `lib/forex-data.ts`
3. `lib/btc-data.ts`
4. `lib/price-analytics.ts`
5. `lib/market-shared.ts`

目标：

- 看懂“页面最终数据”是怎么从 SQLite 行数据计算出来的
- 知道哪些函数是纯计算，哪些函数会访问数据库

这是最值得你反复读的一层，因为它最接近“后端服务层”的思路。

### 第四步：看手动刷新链路

按顺序看：

1. `app/components/manual-refresh-control.tsx`
2. `app/api/manual-snapshot/[group]/route.ts`
3. `lib/manual-snapshot.ts`

目标：

- 看懂按钮点击后会发生什么
- 看懂为什么有冷却期
- 看懂为什么不同页面组会共用同一份快照状态

### 第五步：看双轨同步与启动补偿

按顺序看：

1. `lib/dual-track-sync.ts`
2. `scripts/sync-morning-snapshot.mjs`
3. `scripts/sync-index-data.mjs`

目标：

- 看懂“昨夜收盘快照”和“官方 EOD”为什么分开
- 看懂数据库是如何被脚本写入的
- 看懂首页为什么在服务端渲染前会先跑一次补偿检查

### 第六步：看 SQLite 结构

按顺序看：

1. `prisma/schema.prisma`
2. `lib/prisma.ts`

目标：

- 知道表之间没有复杂关系，当前是非常务实的个人项目数据库设计
- 知道 Prisma 在这里主要负责“让 TypeScript 读写 SQLite 更稳定”

### 第七步：最后看基金季报链路

按顺序看：

1. `app/components/fund-quarterly-dashboard.tsx`
2. `app/api/cn-funds/quarterly/route.ts`
3. `app/api/otc-funds/quarterly/route.ts`
4. `lib/cn-fund-quarterly.ts`

目标：

- 看懂“页面只读本地结果，手动输入代码时才远程抓取”的低频策略
- 看懂一条抓取、解析、保存、展示链路是如何闭环的

这一块逻辑相对更杂，建议放到你对整体项目已经有地图之后再看。

---

## 5. 核心模块逐个说明

### `app/page.tsx`

职责：

- 首页服务端页面入口
- 在服务端并发读取首页卡片、图表默认数据、手动快照状态
- 组织页面展示

依赖：

- `lib/index-data.ts`
- `lib/manual-snapshot.ts`
- `lib/dual-track-sync.ts`

谁会调用它：

- 浏览器访问 `/`

适合后续扩展：

- 新增首页展示块
- 调整首页信息架构

### `lib/index-data.ts`

职责：

- 首页核心服务层
- 从 `DailyPrice` / `MorningCloseSnapshot` 读取数据
- 计算各类涨跌、年化、回撤
- 输出页面卡片数据和图表数据

依赖：

- `prisma`
- `dual-track-sync`
- `price-analytics`
- `market-shared`

谁会调用它：

- 首页页面
- `/api/market`
- `/api/market/chart`

适合后续扩展：

- 新增一个新的指数卡片
- 调整指标口径
- 新增图表范围

### `lib/manual-snapshot.ts`

职责：

- 处理手动快照的读取、冷却、失败降级、时段校验

它和 `DailyPrice` 的关系：

- 手动快照不是长期历史
- 只负责“页面上的最近价格口径”
- 不进入长期指标计算

### `lib/dual-track-sync.ts`

职责：

- 处理“首页头部价格口径”的双轨问题
- 管理早晨快照和正式 EOD 的补偿

这个模块值得重点理解，因为它直接体现了项目的产品判断，而不是单纯技术实现。

### `scripts/sync-index-data.mjs`

职责：

- 把 Twelve Data 的日线写入 `DailyPrice`
- 初始化时补长期历史
- 日常只刷新最近一小段时间

为什么它仍然是脚本：

- 这是个人项目里很常见也很实用的方式
- 任务边界清晰
- 不需要在主应用里内置复杂调度系统

### `lib/cn-fund-quarterly.ts`

职责：

- 负责基金详情抓取、季报正文解析、本地持久化

它比较特殊，因为同时做了：

- 远程请求
- 文本解析
- SQLite 持久化

这块当前是可用且合理的，但也是未来最可能继续拆分的地方。

---

## 6. 关键数据流

### 数据流 1：首页打开后的主流程

```text
浏览器访问 /
-> app/page.tsx
-> ensureStartupCompensation()
-> getMarketCards() / getDefaultMarketCharts() / getSnapshotGroupState("market")
-> Prisma 读取 SQLite
-> lib/index-data.ts 计算卡片与图表数据
-> 页面组件渲染 HTML
```

你阅读这条链路时，最该关注的是：

- 页面层并不直接计算指标
- 页面拿到的是“服务层已经整理好的数据”

### 数据流 2：点击“刷新最新数据”

```text
点击按钮
-> app/components/manual-refresh-control.tsx
-> POST /api/manual-snapshot/[group]
-> lib/manual-snapshot.ts
-> 调 Twelve Data quote
-> upsert ManualSnapshotState
-> 返回最新状态
-> router.refresh() 触发页面重新取数
```

这里最值得理解的点：

- 按页面组刷新，而不是按单个 symbol 刷新
- 命中冷却期时直接复用最近成功结果
- 手动快照失败不会影响历史数据展示

### 数据流 3：同步脚本写入 SQLite

```text
运行 npm run sync:data
-> scripts/sync-index-data.mjs
-> 请求 Twelve Data time_series
-> 整理成日线 rows
-> prisma.dailyPrice.upsert(...)
-> 页面后续从 DailyPrice 读取
```

这条链路回答的是：

- 数据库里的原始历史数据从哪来
- 为什么页面刷新本身不需要再请求 Twelve Data 历史接口

### 数据流 4：基金页新增代码

```text
输入基金代码并提交
-> app/components/fund-quarterly-dashboard.tsx
-> POST /api/cn-funds/quarterly 或 /api/otc-funds/quarterly
-> lib/cn-fund-quarterly.ts
-> 证监会接口查询 fundId
-> 抓取基金详情页
-> 下载最近季报正文并解析
-> upsert FundQuarterlyTracking
-> 页面显示本地保存结果
```

这条链路的关键产品判断是：

- 基金季报是低频数据
- 所以页面默认只读本地，不做每次刷新都重新远程抓取

---

## 7. 当前实现是否主流、是否合理

从个人项目和 Node / SQLite 的角度看，这个项目当前的主线做法是合理且常见的。

### 比较稳妥的地方

- 用 SQLite + Prisma 做个人项目本地数据持久化
- 把远程原始数据和本地计算结果分层
- 脚本负责同步，页面负责展示，服务层负责计算
- 手动快照和正式日线分层存储
- API route 保持很薄，只做调用服务层和返回 JSON

这些都属于“实用、稳妥、便于长期维护”的做法。

### 当前最值得继续注意的地方

1. `lib/cn-fund-quarterly.ts` 责任偏多
   - 现在它把抓取、解析、持久化放在一个文件里
   - 当前规模还可接受，但未来如果基金能力继续变复杂，最好拆成：
     - 远程抓取
     - 解析
     - 存储
     - 页面服务

2. `scripts/*.mjs` 与 `lib/dual-track-sync.ts` 有部分口径重复
   - 当前能接受，因为脚本入口和应用补偿是两个使用场景
   - 但后续如果同步逻辑继续增长，可以考虑再抽一层共享同步服务

3. `lib/index-data.ts` 已经是核心聚合点
   - 这是好事，因为首页逻辑集中
   - 但如果未来首页继续加更多卡片或更多数据源，可能要再拆“查询”和“组装”

这几处都不是“现在必须重写”的问题，更像是你未来继续维护时应重点留意的演化点。

---

## 8. 如果未来继续扩展，最合理的路径

### 场景 1：新增一个页面

推荐顺序：

1. 先定义这个页面需要什么数据
2. 在 `lib/` 新建对应服务层
3. 如需对外 JSON，再补一个 `app/api/.../route.ts`
4. 最后在 `app/.../page.tsx` 里组织展示

核心原则：

- 页面层不要先堆业务逻辑
- 先让服务层把数据整理成“页面已经能直接消费”的结构

### 场景 2：新增一个数据源

推荐顺序：

1. 明确它是“原始数据源”还是“补充实时数据源”
2. 决定是写入 `DailyPrice` 这类长期表，还是独立建表
3. 优先把“请求 + 清洗 + 写库”放到 `scripts/` 或服务层，而不是直接写在页面里

### 场景 3：新增一张 SQLite 表

推荐顺序：

1. 改 `prisma/schema.prisma`
2. 执行 `npm run db:generate`
3. 执行 `npm run db:push`
4. 在 `lib/` 增加读写服务函数
5. 再接页面或 API

### 场景 4：增加更复杂的数据加工

放置建议：

- 纯计算逻辑：放 `lib/price-analytics.ts` 或新建纯函数文件
- 某个页面专属的数据组装：放对应 `lib/*-data.ts`
- 需要数据库读写的业务流程：放对应服务文件，不要塞进 page 或 route

---

## 9. 你下一周最值得重点理解的地方

如果时间有限，我建议你优先理解下面 4 个文件：

1. `app/page.tsx`
   - 看页面如何调用服务层
2. `lib/index-data.ts`
   - 看首页核心数据从哪里来、怎么算出来
3. `lib/manual-snapshot.ts`
   - 看按钮交互、冷却和错误处理
4. `prisma/schema.prisma`
   - 看数据库到底存了什么

只要这四个文件先看懂，这个项目的“主干”就基本立起来了。

然后再看：

5. `lib/dual-track-sync.ts`
6. `scripts/sync-index-data.mjs`
7. `lib/cn-fund-quarterly.ts`

这样你的阅读负担会明显小很多。
