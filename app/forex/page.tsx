import { MarketChart } from "@/app/components/market-chart";
import { MetricRow } from "@/app/components/metric-row";
import { ManualRefreshControl } from "@/app/components/manual-refresh-control";
import { SiteMenu } from "@/app/components/site-menu";
import { formatFxValue } from "@/lib/market-shared";
import { getSnapshotGroupState, getSnapshotRefreshAvailability } from "@/lib/manual-snapshot";
import {
  formatDate,
  getDefaultForexCharts,
  getForexCards,
  getForexMissingDataMessage,
} from "@/lib/forex-data";

export const dynamic = "force-dynamic";

function formatOfficialFxTime(latestDate: Date) {
  return `${latestDate.toISOString().slice(0, 10)} 00:00:00 UTC`;
}

export default async function ForexPage() {
  const [cards, defaultCharts, snapshotState] = await Promise.all([
    getForexCards(),
    getDefaultForexCharts(),
    getSnapshotGroupState("forex"),
  ]);
  const availability = getSnapshotRefreshAvailability("forex");
  const coreCard = cards.find((card) => card.priority === "core") ?? null;
  const otherCards = cards.filter((card) => card.priority !== "core");
  const coreSnapshot = coreCard ? snapshotState.payload[coreCard.symbol] : null;
  const coreCurrentPrice = coreCard ? (coreSnapshot ? coreSnapshot.price : coreCard.currentPrice) : null;
  const coreSourceTime = coreCard
    ? coreSnapshot
      ? `${coreSnapshot.sourceTimestamp} UTC`
      : formatOfficialFxTime(coreCard.latestDate)
    : null;
  const coreSourceLabel = coreSnapshot ? coreSnapshot.sourceLabel : "Twelve Data Time Series (1day)";
  const corePriceType = coreSnapshot ? "当前价格口径 手动快照" : "当前价格口径 官方EOD";

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / FX View</p>
          <h1>汇率观察</h1>
          <p className="hero-copy">
            这个页面用于补充指数观察，重点关注美元相关汇率变化。对中国大陆语境下的美元资产体感来说，
            USD/CNY（1 美元可兑换多少人民币）是最核心的参考。
          </p>
        </div>
      </section>

      <ManualRefreshControl
        group="forex"
        title="手动快照刷新（汇率组合）"
        initialLastSuccessAt={snapshotState.lastSuccessAt ? snapshotState.lastSuccessAt.toISOString() : null}
        initialLastErrorMessage={snapshotState.lastErrorMessage}
        initialCanRefresh={availability.canRefresh}
        initialAvailabilityReason={availability.reason}
      />

      {cards.length === 0 ? (
        <section className="empty-state">
          <h2>暂无汇率数据</h2>
          <p>{getForexMissingDataMessage()}</p>
          <p>配置好 API Key 后，执行 `npm run sync:data` 同步汇率日线。</p>
        </section>
      ) : (
        <>
          {coreCard ? (
            <section className="card-grid forex-core-grid">
              <article className="index-card forex-core-card">
                <div className="card-head">
                  <div>
                    <p className="index-code">{coreCard.symbol}</p>
                    <h2>{coreCard.title}</h2>
                    <p className="hero-copy card-copy">{coreCard.description}</p>
                  </div>
                  <div className="headline-metric">
                    <p>{formatFxValue(coreCurrentPrice ?? coreCard.currentPrice)}</p>
                    <span>{coreSnapshot ? "手动快照时间" : "官方数据时间"} · {coreSourceTime}</span>
                  </div>
                </div>

                <div className="metric-table">
                  <div className="metric-group">
                    <p className="metric-group-title">区间变化</p>
                    <MetricRow label="日涨跌" value={coreCard.dailyChangePct} />
                    <MetricRow label="周涨跌" value={coreCard.weeklyChangePct} />
                    <MetricRow label="月涨跌" value={coreCard.monthlyChangePct} />
                    <MetricRow label="6个月" value={coreCard.sixMonthChangePct} />
                    <MetricRow label="1年" value={coreCard.oneYearChangePct} />
                  </div>
                </div>

                <MarketChart
                  symbol={coreCard.symbol}
                  title={coreCard.title}
                  initialData={defaultCharts[coreCard.symbol]}
                  apiPath="/api/forex/chart"
                  valueType="fx"
                  copyText={`${coreCard.symbol} 趋势图用于快速判断方向，详细判断以下方区间变化为准。`}
                />

                <div className="card-footer">
                  <span>数据日期 {formatDate(coreCard.latestDate)}</span>
                  <span>头部价格来源 {coreSourceLabel}</span>
                  <span>{corePriceType}</span>
                  <span>当前价格时间 {coreSourceTime}</span>
                  <span>方向口径 {coreCard.symbol}</span>
                </div>
              </article>
            </section>
          ) : null}

          {otherCards.length > 0 ? (
            <section className="card-grid">
              {otherCards.map((card) => {
                const snapshot = snapshotState.payload[card.symbol];
                const currentPrice = snapshot ? snapshot.price : card.currentPrice;
                const sourceTime = snapshot
                  ? `${snapshot.sourceTimestamp} UTC`
                  : formatOfficialFxTime(card.latestDate);
                const sourceLabel = snapshot ? snapshot.sourceLabel : "Twelve Data Time Series (1day)";
                const currentPriceType = snapshot ? "当前价格口径 手动快照" : "当前价格口径 官方EOD";

                return (
                  <article key={card.symbol} className="index-card">
                    <div className="card-head">
                      <div>
                        <p className="index-code">{card.symbol}</p>
                        <h2>{card.title}</h2>
                        <p className="hero-copy card-copy">{card.description}</p>
                      </div>
                      <div className="headline-metric">
                        <p>{formatFxValue(currentPrice)}</p>
                        <span>{snapshot ? "手动快照时间" : "官方数据时间"} · {sourceTime}</span>
                      </div>
                    </div>

                    <div className="metric-table">
                      <div className="metric-group">
                        <p className="metric-group-title">区间变化</p>
                        <MetricRow label="日涨跌" value={card.dailyChangePct} />
                        <MetricRow label="周涨跌" value={card.weeklyChangePct} />
                        <MetricRow label="月涨跌" value={card.monthlyChangePct} />
                        <MetricRow label="6个月" value={card.sixMonthChangePct} />
                        <MetricRow label="1年" value={card.oneYearChangePct} />
                      </div>
                    </div>

                    <MarketChart
                      symbol={card.symbol}
                      title={card.title}
                      initialData={defaultCharts[card.symbol]}
                      apiPath="/api/forex/chart"
                      valueType="fx"
                      copyText={`${card.symbol} 趋势图用于补充观察美元相关汇率变化。`}
                    />

                    <div className="card-footer">
                      <span>数据日期 {formatDate(card.latestDate)}</span>
                      <span>头部价格来源 {sourceLabel}</span>
                      <span>{currentPriceType}</span>
                      <span>当前价格时间 {sourceTime}</span>
                      <span>方向口径 {card.symbol}</span>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
