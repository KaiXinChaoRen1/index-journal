# 开发说明

## 1. 初始化步骤

```bash
npm install
npm run db:generate
npm run db:push
```

然后在 `.env` 中配置：

```bash
DATABASE_URL="file:./dev.db"
TWELVE_DATA_API_KEY="你的 API Key"
```

再执行：

```bash
npm run sync:data
npm run dev
```

## 2. 为什么服务要监听 `0.0.0.0`

因为项目有明确要求：

- 本机可打开
- 局域网内其他设备也可打开

所以开发和生产启动都绑定：

```bash
0.0.0.0:3000
```

## 3. Prisma 开发流程

修改 `prisma/schema.prisma` 后，执行：

```bash
npm run db:generate
npm run db:push
```

当前项目优先开发速度，因此使用 `db push`。

## 4. 同步脚本的理解方式

你可以把同步理解成双轨任务：

- 早晨快照：`SPY` / `QQQ` 收盘快照（首页头部优先展示）
- 正式日线：长期历史 + 增量刷新（指标和图表统一口径）

当前实现已经升级为：

- 初始化时尽量补齐长期历史
- 日常同步只刷新最近一小段
- 快照与日线分表存储，按口径读取
- 指标继续由服务端读取日线后动态计算

## 5. 定时任务建议

当前仓库没有内置调度器。

推荐你用系统自己的定时方式执行：

- macOS `launchd`
- Linux `cron`
- 部署平台的 Scheduled Job

推荐时间：

- 北京时间每天 `06:00`：`npm run sync:morning`
- 北京时间每天 `14:00`：`npm run sync:eod`（或 `npm run sync:data`）

## 6. 出错时先看哪里

### 如果同步失败

先检查：

1. `.env` 里有没有 `TWELVE_DATA_API_KEY`
2. Twelve Data Key 是否可用（`quote` 和 `time_series`）
3. 返回是否 hit 了额度限制

### 如果页面没数据显示

先检查：

1. 数据库里是否已经有 `SPY` / `QQQ` 数据
2. 是否执行过 `npm run sync:morning` / `npm run sync:eod`
3. API `/api/market` 是否返回数据

### 如果 10 年指标显示“数据不足”

先检查：

1. 长期历史是否已经补齐
2. Twelve Data 当前账号是否拿到了足够早的历史
3. 数据库里该 symbol 的最早日期是否早于目标日期

### 如果“刷新最新数据”按钮不可用或返回冷却

先检查：

1. 当前页面组是否允许刷新（BTC 7x24；指数/汇率仅纽约常规交易时段）
2. 最近一次成功刷新是否在 5 分钟内（冷却期内会直接复用快照）
3. `ManualSnapshotState` 是否已有该页面组的最近成功记录

### 如果手动刷新失败但页面没崩

这是预期的降级行为，先检查：

1. Twelve Data 是否返回了额度限制
2. `.env` 中 `TWELVE_DATA_API_KEY` 是否缺失或无效
3. API `/api/manual-snapshot/[group]` 返回的 `message` 与 `lastErrorMessage`

## 7. 推荐工作流

1. 先读 `AGENTS.md`
2. 再看 `README.md`
3. 再看 `docs/architecture.md`
4. 改代码
5. 如涉及定位或结构变化，同步更新文档与 `/log`
6. 跑 `npm run lint`
7. 跑 `npm run build`
