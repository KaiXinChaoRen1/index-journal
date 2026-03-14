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

你可以把同步脚本理解成一个每日盘后任务：

- 输入：`SPY` / `QQQ` 的长期历史与最近增量区间
- 输出：本地数据库中的 ETF 历史行情

当前实现已经升级为：

- 初始化时尽量补齐长期历史
- 日常同步只刷新最近一小段

它不直接保存计算后的指标，
而是把这些指标交给服务端读取时动态计算。

## 5. 定时任务建议

当前仓库没有内置调度器。

推荐你用系统自己的定时方式执行：

- macOS `launchd`
- Linux `cron`
- 部署平台的 Scheduled Job

推荐时间：

- 北京时间每天 `06:00`

执行命令：

```bash
npm run sync:data
```

## 6. 出错时先看哪里

### 如果同步失败

先检查：

1. `.env` 里有没有 `TWELVE_DATA_API_KEY`
2. Twelve Data Key 是否可用
3. 返回是否 hit 了额度限制

### 如果页面没数据显示

先检查：

1. 数据库里是否已经有 `SPY` / `QQQ` 数据
2. 是否执行过 `npm run sync:data`
3. API `/api/market` 是否返回数据

### 如果 10 年指标显示“数据不足”

先检查：

1. 长期历史是否已经补齐
2. Twelve Data 当前账号是否拿到了足够早的历史
3. 数据库里该 symbol 的最早日期是否早于目标日期

## 7. 推荐工作流

1. 先读 `AGENTS.md`
2. 再看 `README.md`
3. 再看 `docs/architecture.md`
4. 改代码
5. 如涉及定位或结构变化，同步更新文档与 `/log`
6. 跑 `npm run lint`
7. 跑 `npm run build`
