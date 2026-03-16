import { MarketChart } from "@/app/components/market-chart";
import { MetricRow } from "@/app/components/metric-row";
import { ManualRefreshControl } from "@/app/components/manual-refresh-control";
import { SiteMenu } from "@/app/components/site-menu";
import { LivePrice } from "@/app/components/live-price";
import { ensureStartupCompensation } from "@/lib/dual-track-sync";
import {
  formatDate,
  formatDateOrFallback,
  formatIndexValue,
  getDefaultMarketCharts,
  getMarketCards,
  getMissingDataMessage,
} from "@/lib/index-data";
import {
  getSnapshotGroupState,
  getSnapshotRefreshAvailability,
  triggerBackgroundRefresh,
} from "@/lib/manual-snapshot";

export const dynamic = "force-dynamic";

// 首页是服务端页面入口。
// 阅读建议：先看这里用了哪些服务函数，再往 lib/ 里追数据是如何被读取和计算的。
export default async function HomePage() {
  // 页面在真正取数前先做一次"启动补偿"，目的是避免当天该有的快照 / EOD
  // 还没跑到，但用户已经先打开了站点。
  await ensureStartupCompensation();

  // 后台检查并触发 BTC/Forex 刷新（不等待结果）
  // 这样用户后续进入这些页面时数据可能已经更新
  void triggerBackgroundRefresh("btc");
  void triggerBackgroundRefresh("forex");

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
  const showLivePrice = availability.canRefresh;

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
        title="手动快照刷新"
        initialLastSuccessAt={snapshotState.lastSuccessAt ? snapshotState.lastSuccessAt.toISOString() : null}
        initialLastErrorMessage={snapshotState.lastErrorMessage}
        initialCanRefresh={availability.canRefresh}
        initialAvailabilityReason={availability.reason}
      />

      {cards.length === 0 ? (
        <section className="empty-state">
          <h2>暂无数据</h2>
          <p>{getMissingDataMessage()}</p>
          <p>请执行 `npm run sync:data` 同步市场日线。</p>
        </section>
      ) : (
        <section className="card-grid">
          {cards.map((card) => (
            <article key={card.marketKey} className="index-card">
              <div className="card-head">
                <div>
                  <p className="index-code">{card.symbol}</p>
                  <h2>{card.title}</h2>
                  <p className="hero-copy card-copy">{card.description}</p>
                </div>
                {showLivePrice ? (
                  <LivePrice symbol={card.symbol} mode="index" />
                ) : (
                  <div className="headline-metric">
                    <p>{formatIndexValue(card.currentPrice)}</p>
                    <span>
                      {card.headlineMode === "morning_snapshot" ? "昨夜收盘" : "官方收盘"} ·{" "}
                      {card.headlineTime} UTC
                    </span>
                  </div>
                )}
              </div>

              <div className="metric-table">
                <div className="metric-group">
                  <p className="metric-group-title">短期表现</p>
                  <MetricRow label="日涨跌" value={card.dailyChangePct} />
                  <MetricRow label="周涨跌" value={card.weeklyChangePct} />
                  <MetricRow label="月涨跌" value={card.monthlyChangePct} />
                  <MetricRow label="6个月" value={card.sixMonthChangePct} />
                  <MetricRow label="1年" value={card.oneYearChangePct} />
                </div>

                <div className="metric-group">
                  <p className="metric-group-title">中长期表现</p>
                  <MetricRow label="2年" value={card.twoYearChangePct} />
                  <MetricRow label="5年" value={card.fiveYearChangePct} />
                  <MetricRow label="10年" value={card.tenYearChangePct} />
                  <MetricRow label="YTD" value={card.ytdChangePct} />
                </div>

                <div className="metric-group">
                  <p className="metric-group-title">年化回报</p>
                  <MetricRow label="5年年化" value={card.fiveYearAnnualizedReturnPct} />
                  <MetricRow label="10年年化" value={card.tenYearAnnualizedReturnPct} />
                </div>

                <div className="metric-group">
                  <p className="metric-group-title">回撤</p>
                  <MetricRow label="距历史高点" value={card.drawdownFromAthPct} />
                  {card.athClose ? (
                    <div className="metric-row">
                      <span className="metric-label">历史高点</span>
                      <span className="metric-value">
                        {formatIndexValue(card.athClose)} @{" "}
                        {card.athDate ? formatDateOrFallback(card.athDate) : "--"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <MarketChart
                symbol={card.symbol}
                title={card.title}
                initialData={defaultCharts[card.symbol]}
                apiPath="/api/market/chart"
                valueType="index"
                copyText={`${card.title} 的趋势图只负责帮助快速看方向，详细解读仍以下方指标为主。`}
              />

              <div className="card-footer">
                <span>数据日期 {formatDate(card.latestDate)}</span>
                <span>当前价格来源 {showLivePrice ? "Twelve Data Official API" : card.headlineSourceLabel}</span>
                <span>{showLivePrice ? "当前价格口径 盘中实时价（约 1 分钟刷新）" : `当前价格时间 ${card.headlineTime} UTC`}</span>
                <span>方向口径 {card.marketKey}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
