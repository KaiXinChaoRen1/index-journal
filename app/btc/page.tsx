import { MarketChart } from "@/app/components/market-chart";
import { MetricRow } from "@/app/components/metric-row";
import { ManualRefreshControl } from "@/app/components/manual-refresh-control";
import { SiteMenu } from "@/app/components/site-menu";
import { formatIndexValue } from "@/lib/market-shared";
import {
  getSnapshotGroupState,
  getSnapshotRefreshAvailability,
} from "@/lib/manual-snapshot";
import {
  formatDate,
  getBtcCard,
  getBtcMissingDataMessage,
  getDefaultBtcChart,
} from "@/lib/btc-data";

export const dynamic = "force-dynamic";

export default async function BtcPage() {
  // BTC 页面只读取数据，刷新逻辑由首页后台触发或用户手动触发
  // 避免用户进入页面时因同步刷新而等待
  const [card, defaultChart, snapshotState, refreshAvailability] = await Promise.all([
    getBtcCard(),
    getDefaultBtcChart(),
    getSnapshotGroupState("btc"),
    getSnapshotRefreshAvailability("btc"),
  ]);
  const snapshot = snapshotState.payload["BTC/USD"];

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / BTC View</p>
          <h1>BTC 观察</h1>
          <p className="hero-copy">
            这个页面是指数与汇率之外的补充观察入口，用于查看 BTC/USD 的价格位置和主要区间表现，
            保持长期观察视角，不做交易终端式信息堆叠。
          </p>
        </div>
      </section>

      <ManualRefreshControl
        group="btc"
        title="手动快照刷新（BTC/USD）"
        initialLastSuccessAt={snapshotState.lastSuccessAt ? snapshotState.lastSuccessAt.toISOString() : null}
        initialLastErrorMessage={snapshotState.lastErrorMessage}
        initialCanRefresh={refreshAvailability.canRefresh}
        initialAvailabilityReason={refreshAvailability.reason}
      />

      {!card ? (
        <section className="empty-state">
          <h2>暂无 BTC 数据</h2>
          <p>{getBtcMissingDataMessage()}</p>
          <p>配置好 API Key 后，执行 `npm run sync:data` 同步 BTC/USD 日线。</p>
        </section>
      ) : (
        <section className="card-grid forex-core-grid">
          <article className="index-card forex-core-card">
            <div className="card-head">
              <div>
                <p className="index-code">{card.symbol}</p>
                <h2>{card.title}</h2>
                <p className="hero-copy card-copy">{card.description}</p>
              </div>
              <div className="headline-metric">
                <p>{formatIndexValue(snapshot ? snapshot.price : card.currentPrice)}</p>
                <span>
                  {snapshot
                    ? `手动快照时间 · ${snapshot.sourceTimestamp} UTC`
                    : `官方数据时间 · ${formatDate(card.latestDate)} UTC 交易日`}
                </span>
              </div>
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
                <MetricRow label="3年" value={card.threeYearChangePct} />
                <MetricRow label="5年" value={card.fiveYearChangePct} />
                <MetricRow label="10年" value={card.tenYearChangePct} />
              </div>

              <div className="metric-group">
                <p className="metric-group-title">回撤</p>
                <MetricRow label="最大回撤" value={card.maxDrawdownPct} />
              </div>
            </div>

            <MarketChart
              symbol={card.symbol}
              title={card.title}
              initialData={defaultChart}
              apiPath="/api/btc/chart"
              valueType="index"
              copyText="BTC/USD 趋势图用于快速判断价格位置，详细判断以下方区间变化为准。"
            />

            <div className="card-footer">
              <span>数据日期 {formatDate(card.latestDate)}</span>
              <span>头部价格来源 {snapshot ? snapshot.sourceLabel : "Twelve Data Time Series (1day)"}</span>
              <span>{snapshot ? "当前价格口径 手动快照" : "当前价格口径 官方EOD"}</span>
              <span>
                当前价格时间 {snapshot ? `${snapshot.sourceTimestamp} UTC` : `${formatDate(card.latestDate)} UTC 交易日`}
              </span>
              <span>方向口径 BTC/USD</span>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
