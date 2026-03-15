import { MarketChart } from "@/app/components/market-chart";
import { MetricRow } from "@/app/components/metric-row";
import { ManualRefreshControl } from "@/app/components/manual-refresh-control";
import { SiteMenu } from "@/app/components/site-menu";
import { ensureStartupCompensation } from "@/lib/dual-track-sync";
import {
  formatDate,
  formatDateOrFallback,
  formatIndexValue,
  getDefaultMarketCharts,
  getMarketCards,
  getMissingDataMessage,
} from "@/lib/index-data";
import { getSnapshotGroupState, getSnapshotRefreshAvailability } from "@/lib/manual-snapshot";

export const dynamic = "force-dynamic";

// 首页是服务端页面入口。
// 阅读建议：先看这里用了哪些服务函数，再往 lib/ 里追数据是如何被读取和计算的。
export default async function HomePage() {
  // 页面在真正取数前先做一次“启动补偿”，目的是避免当天该有的快照 / EOD
  // 还没跑到，但用户已经先打开了站点。
  await ensureStartupCompensation();

  // 首页真正依赖的只有三份数据：
  // 1. 卡片指标
  // 2. 图表默认点位
  // 3. 最近一次手动快照状态
  const [cards, defaultCharts, snapshotState] = await Promise.all([
    getMarketCards(),
    getDefaultMarketCharts(),
    getSnapshotGroupState("market"),
  ]);
  const availability = getSnapshotRefreshAvailability("market");

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Index Journal</p>
          <h1>指数日志</h1>
          <p className="hero-copy">
            一个围绕指数投资、市场观察与 AI 协作开发展开的个人站点。当前使用 SPY 与
            QQQ 作为标普 500 和纳指 100 的替代跟踪，专注展示盘后可读、可复盘的核心信息。
          </p>
        </div>
      </section>

      <ManualRefreshControl
        group="market"
        title="手动快照刷新（SPY / QQQ）"
        initialLastSuccessAt={snapshotState.lastSuccessAt ? snapshotState.lastSuccessAt.toISOString() : null}
        initialLastErrorMessage={snapshotState.lastErrorMessage}
        initialCanRefresh={availability.canRefresh}
        initialAvailabilityReason={availability.reason}
      />

      {cards.length === 0 ? (
        <section className="empty-state">
          <h2>暂无数据</h2>
          <p>{getMissingDataMessage()}</p>
          <p>配置好 API Key 后，执行 `npm run setup:data` 初始化数据库并同步 ETF 日线。</p>
        </section>
      ) : (
        <section className="card-grid">
          {cards.map((card) => {
            const snapshot = snapshotState.payload[card.symbol];
            const currentPrice = snapshot ? snapshot.price : card.currentPrice;
            const headlineLabel = snapshot
              ? `手动快照 · ${snapshot.sourceTimestamp} UTC`
              : `${card.headlineMode === "morning_snapshot" ? "昨夜收盘快照" : "官方EOD"} · ${card.headlineTime}`;
            const headlineSource = snapshot ? snapshot.sourceLabel : card.headlineSourceLabel;
            const currentPriceType = snapshot
              ? "当前价格口径 手动快照"
              : card.headlineMode === "morning_snapshot"
                ? "当前价格口径 昨夜收盘快照"
                : "当前价格口径 官方EOD";
            const currentPriceTime = snapshot
              ? `当前价格时间 ${snapshot.sourceTimestamp} UTC`
              : `当前价格时间 ${card.headlineTime}`;

            return (
              <article key={card.marketKey} className="index-card">
                <div className="card-head">
                  <div>
                    <p className="index-code">{card.symbol}</p>
                    <h2>{card.title}</h2>
                    <p className="hero-copy card-copy">{card.description}</p>
                  </div>
                  <div className="headline-metric">
                    <p>{formatIndexValue(currentPrice)}</p>
                    <span>{headlineLabel}</span>
                  </div>
                </div>

                <div className="metric-table">
                  <div className="metric-group">
                    <p className="metric-group-title">短期表现</p>
                    <MetricRow label="日涨跌" value={card.dailyChangePct} />
                    <MetricRow label="周涨跌" value={card.weeklyChangePct} />
                    <MetricRow label="月涨跌" value={card.monthlyChangePct} />
                  </div>

                  <div className="metric-group">
                    <p className="metric-group-title">中长期表现</p>
                    <MetricRow label="6个月" value={card.sixMonthChangePct} />
                    <MetricRow label="1年" value={card.oneYearChangePct} />
                    <MetricRow label="2年" value={card.twoYearChangePct} />
                    <MetricRow label="5年" value={card.fiveYearChangePct} />
                    <MetricRow label="10年" value={card.tenYearChangePct} />
                    <MetricRow label="YTD" value={card.ytdChangePct} />
                  </div>

                  <div className="metric-group">
                    <p className="metric-group-title">长期质量指标</p>
                    <MetricRow label="5年年化" value={card.fiveYearAnnualizedReturnPct} />
                    <MetricRow label="10年年化" value={card.tenYearAnnualizedReturnPct} />
                    <MetricRow label="距历史高点回撤" value={card.drawdownFromAthPct} />
                  </div>
                </div>

                <MarketChart
                  symbol={card.symbol}
                  title={card.title}
                  initialData={defaultCharts[card.symbol]}
                />

                <div className="card-footer">
                  <span>数据日期 {formatDate(card.latestDate)}</span>
                  <span>头部价格来源 {headlineSource}</span>
                  <span>{currentPriceType}</span>
                  <span>{currentPriceTime}</span>
                  <span>{card.symbol} 作为指数替代追踪</span>
                  <span>
                    历史高点 {card.athClose ? formatIndexValue(card.athClose) : "数据不足"} /{" "}
                    {formatDateOrFallback(card.athDate)}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
