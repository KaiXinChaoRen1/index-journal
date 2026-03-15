# Index Journal

Index Journal 是一个围绕指数投资、市场观察、AI 协作开发与个人学习过程展开的长期项目。

它当前首先是一个可用的个人工具：我可以每天打开它，快速看见美股核心指数相关数据，而不用在手机 App 里临时翻找。

但它不只是一块数据面板。它还同时承担另外几层意义：

- 它是一次真实的 AI 协作开发实践，记录“一个想法如何在与 agent 的往返中慢慢长成产品”
- 它是我学习新技术栈和新语言的实践样本，不停留在 Java / Python 的舒适区
- 它是一个可以进入作品集和简历的长期个人项目，体现产品思考、结构能力和可维护性
- 它也是一份会持续积累的数字作品，未来可以承载开发日志、设计判断、投资阅读和市场思考

## 这个项目现在在做什么

当前版本聚焦在一件事上：用尽量克制的产品形态，展示美股核心指数的盘后状态。

为了降低授权和维护复杂度，当前不直接抓指数本体，而是使用 ETF 作为替代：

- 标普 500 -> `SPY`
- 纳斯达克 100 -> `QQQ`

系统当前已完成：

1. 从 Twelve Data 拉取 `SPY` / `QQQ` 日线
2. 长期历史入库，并支持日常增量同步
3. 在本地计算日 / 周 / 月 / 6M / 1Y / 2Y / 5Y / 10Y / YTD / 年化收益 / 回撤
4. 提供首页卡片与走势图
5. 提供 `/api/market` 和 `/api/market/chart`
6. 提供“开发日志”页面，记录产品取舍和项目定位
7. 提供“昨夜收盘快照 + 官方EOD”双轨展示口径（仅首页头部价格）
8. 提供汇率观察页与 BTC 观察页，统一复用本地日线计算与走势图组件

当前明确不做：

- 盘中实时数据
- 专业交易终端式的复杂交互
- 后台管理系统
- 为了“看起来很强”而堆叠的大量入口和按钮

## 为什么值得认真做

这个项目值得长期做，不是因为功能很多，而是因为它同时连接了两条主线：

1. 指数投资 / 市场观察
2. 编程开发 / 产品学习 / AI 协作

这意味着它既要真实可用，也要可回看、可学习、可复盘。它不是一次性 demo，而是一块可以慢慢生长的地基。

## 当前产品原则

- 不为了堆功能而开发，先把真正有价值的核心体验站稳
- 能做不代表现在就该做，接受阶段性取舍
- 按钮越多越像工具，不像产品；首页必须保持克制
- 图表、指标、日志和导航都应该服务清晰与可理解，而不是炫技
- 低频但有价值的内容通过导航进入，不挤占首页主视图
- 代码不只要能跑，还要让人能读懂，因为阅读代码本身也是学习过程的一部分

## 技术与数据选择

技术栈：

- Next.js
- TypeScript
- SQLite
- Prisma
- CSRC 季报解析：`pdf-parse@1.1.1`（PDF）+ `mammoth`（Word）

当前数据源：

- Twelve Data `time_series`
- Twelve Data `quote`（仅用于首页早晨快照）

口径术语：

- `昨夜收盘快照`：北京早晨优先展示的快速口径，用于先看昨晚收盘方向
- `官方EOD`：官方日线最终口径，用于正式统计、长期指标与图表

为什么先用 ETF 替代指数本体：

- 授权复杂度更低
- 免费额度足够个人场景
- 足以支撑盘后观察和本地指标计算
- 可以先把产品形态和数据链路稳定下来

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
DATABASE_URL="file:./dev.db"
TWELVE_DATA_API_KEY="你的 Twelve Data API Key"
```

3. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

4. 同步历史数据

```bash
npm run sync:data
```

可选脚本（双轨同步）：

```bash
npm run sync:morning
npm run sync:eod
```

5. 启动服务

```bash
npm run dev
```

访问地址：

- 本机：`http://localhost:3000`
- 局域网：`http://你的局域网 IP:3000`

## 当前页面与接口

当前页面：

- `/`：首页市场面板
- `/log`：开发日志 / 产品日志
- `/forex`：汇率观察
- `/btc`：BTC 观察
- `/cn-funds`：国内场内基金（固定基金季报抓取验证）
- `/otc-funds`：场外基金（固定基金季报多份额净值表现）

当前接口：

- `GET /api/market`
- `GET /api/market/chart?symbol=SPY&range=1Y`
- `GET /api/forex`
- `GET /api/forex/chart?symbol=USD/CNY&range=1Y`
- `GET /api/btc`
- `GET /api/btc/chart?symbol=BTC/USD&range=1Y`
- `GET /api/cn-funds/quarterly`
- `GET /api/otc-funds/quarterly`
- `GET /api/manual-snapshot/[group]`
- `POST /api/manual-snapshot/[group]`

季报解析与刷新：

- `/cn-funds` 与 `/otc-funds` 抓取证监会披露季报，提取 “3.2.1 基金份额净值增长率及其与同期业绩比较基准收益率的比较”
- 支持多份额（A/C/I 等）分表展示
- 接口默认 30 分钟缓存；可用 `?refresh=1` 强制重新抓取

手动刷新策略：

- 仅用户手动触发，不做自动高频轮询
- 按页面数据组做 5 分钟节流（`market` / `forex` / `btc`）
- BTC 支持 7x24；指数与汇率仅纽约常规交易时段允许刷新

图表范围固定为：

- `1M`
- `6M`
- `1Y`
- `5Y`
- `MAX`

## 文档分工

- `README.md`
  面向项目访客和未来的自己，解释项目是什么、为什么做、当前做到哪里。
- `AGENTS.md`
  面向后续接手的 AI agent，也给人类开发者提供更明确的协作口径、开发原则和代码要求。
- `docs/architecture.md`
  面向技术实现，解释数据链路和模块职责。
- `docs/development.md`
  面向日常开发流程、同步、排错和验证。
- `docs/data-sources.md`
  面向数据源选择和后续切换空间。
- `docs/code-review.md`
  面向阶段性代码审查与收尾记录。

## 未来方向

这个项目未来的增长方向已经明确，但不打算一次性全部塞进当前版本。

优先顺序大致如下：

1. 首页 / 市场面板
   继续承担指数数据查看功能，是项目的核心入口。
2. 开发日志 / 产品日志
   记录为什么这样做，而不是那样做；保留设计取舍和项目哲学。
3. 投资阅读 / 市场思考
   作为未来方向，沉淀对股东信、市场文章、投资阅读的摘录与短评。
4. About / 关于项目
   作为可选页，说明这是一个关于指数、学习和 AI 协作的个人站点。
5. 设置 / 实验区 / Debug
   低优先级，不应抢主导航，只在更深层或开发态出现。

## 推荐继续阅读

1. [AGENTS.md](./AGENTS.md)
2. [docs/architecture.md](./docs/architecture.md)
3. [docs/development.md](./docs/development.md)
4. [docs/data-sources.md](./docs/data-sources.md)
