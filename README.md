# Index Journal

Index Journal 是一个聚焦美股核心指数的盘后市场观察面板。

它面向两类使用者：

- 关注指数投资的人：打开就能快速看见美股核心指数的位置、阶段变化和长期表现，而不用在手机 App 里临时翻找。
- 想自建市场面板的人：可以直接克隆部署，得到一个克制、可读、长期可维护的指数观察站。

它专注于一件事并把它做扎实：用尽量克制的产品形态，呈现 `SPY` / `QQQ` 的盘后状态与长期指标。

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
6. 提供“昨夜收盘快照 + 官方EOD”双轨展示口径（仅首页头部价格）
7. 提供汇率观察页与 BTC 观察页，统一复用本地日线计算与走势图组件
8. 在纽约常规交易时段，首页头部可显示 ETF 轻量实时价；区间指标和图表仍只使用本地日线

当前明确不做：

- 交易终端式盘中实时行情
- 专业交易终端式的复杂交互
- 后台管理系统
- 为了“看起来很强”而堆叠的大量入口和按钮

## 它解决什么问题

盘后想快速判断核心指数的位置和方向时，手机 App 往往要逐个点开、逐项翻找，且各家口径不一。

Index Journal 把这件事收敛成一个页面：

- 一眼看到 `SPY` / `QQQ` 的当前位置、日内方向和回撤
- 所有阶段涨跌、年化、回撤都用统一口径在本地计算，不依赖第三方现成结论
- 长期历史落到本地，换数据源也不影响指标方法学的稳定

它不是交易终端，也不追求功能数量，追求的是“盘后打开就能看懂”。

## 当前产品原则

- 不为了堆功能而开发，先把真正有价值的核心体验站稳
- 能做不代表现在就该做，接受阶段性取舍
- 按钮越多越像工具，不像产品；首页必须保持克制
- 图表、指标和导航都应该服务清晰与可理解，而不是炫技
- 低频但有价值的内容通过导航进入，不挤占首页主视图
- 代码不只要能跑，还要让接手维护的人能读懂

## 技术与数据选择

技术栈：

- Next.js
- TypeScript
- SQLite
- Prisma
- CSRC 季报解析：`pdf-parse@1.1.1`（PDF）+ `mammoth`（Word）

当前数据源：

- Twelve Data `time_series`：正式日线，负责长期历史、图表和指标
- Twelve Data `quote`：早晨快照、手动快照和首页纽约时段轻量实时价
- FMP / Stooq：仅用于首页头部“真实指数点位”展示；不进入长期指标计算

口径术语：

- `昨夜收盘快照`：北京早晨优先展示的快速口径，用于先看昨晚收盘方向
- `官方EOD`：官方日线最终口径，用于正式统计、长期指标与图表
- `真实指数点位`：首页头部展示层信息，优先 FMP，失败后回退 Stooq；指标口径仍是 `SPY` / `QQQ` 日线

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
FMP_API_KEY="可选，用于首页真实指数点位优先源"
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

## Docker 部署

Docker 只是可选的单机部署路径，日常本地开发仍然使用 `npm run dev`。为了和本机开发端口隔离，部署脚本默认把宿主机 `3100` 映射到容器内 `3000`。

1. 设置 API Key

```bash
export TWELVE_DATA_API_KEY="你的 Twelve Data API Key"
```

2. 启动或更新容器

```bash
./deploy.sh
```

3. 首次同步历史数据

```bash
docker exec index-journal npm run sync:data
```

说明：

- 默认访问地址是 `http://服务器 IP:3100`
- 如需改宿主端口，执行前设置 `HOST_PORT=目标端口`
- 容器启动时会自动执行 `prisma db push`，保证 SQLite schema 已初始化
- SQLite 数据库放在容器内 `/data/dev.db`，因此要挂载宿主机目录做持久化
- 如果不提供 `TWELVE_DATA_API_KEY`，页面仍可启动，但同步脚本和手动刷新不会成功
- `deploy.sh` 会先构建新镜像，再替换旧容器；如果新容器启动失败，会尽量恢复旧容器

## Linux 服务器从克隆到运行

下面这套流程面向“拿到一台 Linux 云服务器，从零开始拉代码并跑起来”。

### 你需要先准备好

1. 一台能联网的 Linux 服务器
2. 服务器已安装 `git` 和 `docker`
3. 你自己的 `TWELVE_DATA_API_KEY`
4. 云厂商安全组或服务器防火墙已放行你的服务端口，默认是 `3100`

如果你还没装 Docker，以 Ubuntu / Debian 为例：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
```

### 1. 克隆仓库

如果你的服务器已经配置了 GitHub SSH Key：

```bash
git clone git@github.com:KaiXinChaoRen1/index-journal.git
cd index-journal
```

如果你更想用 HTTPS：

```bash
git clone https://github.com/KaiXinChaoRen1/index-journal.git
cd index-journal
```

### 2. 设置环境变量

先把 API Key 放进当前 shell：

```bash
export TWELVE_DATA_API_KEY="你的 Twelve Data API Key"
```

如果你希望每次登录服务器都自动生效，可以把它写进 `~/.bashrc` 或 `~/.zshrc`。

### 3. 启动容器

```bash
./deploy.sh
```

脚本会自动完成：

1. 创建 `./data` 持久化目录
2. 构建 `index-journal:latest` 镜像
3. 启动容器，并将宿主机 `3100` 映射到容器内 `3000`
4. 容器内先执行 `prisma db push`，再启动 `next start`

### 4. 首次同步历史数据

```bash
docker exec index-journal npm run sync:data
```

如果你这一步暂时不执行，页面也能打开，只是会处于“无数据”状态。

### 5. 验证服务是否正常

看容器状态：

```bash
docker ps
```

看启动日志：

```bash
docker logs -f index-journal
```

本机验证：

```bash
curl http://127.0.0.1:3100
```

浏览器访问：

```text
http://你的服务器公网 IP:3100
```

如果外网打不开，优先检查：

1. 云服务器安全组是否放行 `3100`
2. 服务器本机防火墙是否放行 `3100`
3. 容器是否真的启动成功

### 6. 后续常用操作

停止容器：

```bash
docker stop index-journal
```

启动已存在的容器：

```bash
docker start index-journal
```

重启容器：

```bash
docker restart index-journal
```

查看最近日志：

```bash
docker logs --tail 200 index-journal
```

进入容器：

```bash
docker exec -it index-journal sh
```

### 7. 更新到最新代码

```bash
cd index-journal
git pull
./deploy.sh
```

因为数据库挂载在宿主机 `./data`，所以重建容器后数据仍然会保留。

如果你想临时使用别的宿主端口：

```bash
HOST_PORT=8080 ./deploy.sh
```

## 当前页面与接口

当前页面：

- `/`：首页市场面板
- `/forex`：汇率观察
- `/btc`：BTC 观察
- `/cn-funds`：国内场内基金（本地保存的季报跟踪）
- `/otc-funds`：场外基金（本地保存的季报跟踪）

当前接口：

- `GET /api/market`
- `GET /api/market/chart?symbol=SPY&range=1Y`
- `GET /api/forex`
- `GET /api/forex/chart?symbol=USD/CNY&range=1Y`
- `GET /api/btc`
- `GET /api/btc/chart?symbol=BTC/USD&range=1Y`
- `GET /api/live-price?symbol=SPY`
- `GET /api/cn-funds/quarterly`
- `GET /api/otc-funds/quarterly`
- `POST /api/cn-funds/quarterly`
- `POST /api/otc-funds/quarterly`
- `GET /api/manual-snapshot/[group]`
- `POST /api/manual-snapshot/[group]`

季报解析与刷新：

- `/cn-funds` 与 `/otc-funds` 默认只读取本地 SQLite 中已保存的季报解析结果
- 手动输入 6 位基金代码或点击页面内“重新抓取”时，才会请求证监会披露季报，提取 “3.2.1 基金份额净值增长率及其与同期业绩比较基准收益率的比较”
- 支持多份额（A/C/I 等）分表展示
- 当前不再依赖固定代码配置，基金跟踪列表由本地数据库保存

手动刷新策略：

- 首页指数手动刷新仅用户点击触发，且仅纽约常规交易时段允许
- 汇率与 BTC 允许 7x24 刷新；页面访问时会后台检查最近快照，过期后触发一次非阻塞刷新
- 手动快照按页面数据组节流：`market` 为 1 分钟，`forex` / `btc` 为 5 分钟
- 所有快照只影响头部当前价格参考，区间统计继续使用本地日线历史

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
- `docs/design-system.md`
  面向页面视觉与样式约定。

## 未来方向

这个项目未来的增长方向已经明确，但不打算一次性全部塞进当前版本。

优先顺序大致如下：

1. 首页 / 市场面板
   继续承担指数数据查看功能，是项目的核心入口。
2. 投资阅读 / 市场思考
   作为未来方向，沉淀对股东信、市场文章、投资阅读的摘录与短评。
3. About / 关于本站
   作为可选页，说明这个面板是什么、覆盖哪些标的、数据口径如何。
4. 设置 / 实验区 / Debug
   低优先级，不应抢主导航，只在更深层或开发态出现。

## 推荐继续阅读

1. [AGENTS.md](./AGENTS.md)
2. [docs/architecture.md](./docs/architecture.md)
3. [docs/development.md](./docs/development.md)
4. [docs/data-sources.md](./docs/data-sources.md)
