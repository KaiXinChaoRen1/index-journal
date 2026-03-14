import { MarketChart } from "@/app/components/market-chart";
import { SiteMenu } from "@/app/components/site-menu";
import { formatFxValue } from "@/lib/market-shared";
import {
  formatDate,
  formatPercentOrFallback,
  getDefaultForexCharts,
  getForexCards,
  getForexMissingDataMessage,
} from "@/lib/forex-data";

export const dynamic = "force-dynamic";

function getTone(value: number) {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}

function getNullableTone(value: number | null) {
  return value === null ? "neutral" : getTone(value);
}

function formatOfficialFxTime(latestDate: Date) {
  return `${latestDate.toISOString().slice(0, 10)} 00:00:00 UTC`;
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong className={getNullableTone(value)}>{formatPercentOrFallback(value)}</strong>
    </div>
  );
}

export default async function ForexPage() {
  const cards = await getForexCards();
  const defaultCharts = await getDefaultForexCharts();
  const coreCard = cards.find((card) => card.priority === "core") ?? null;
  const otherCards = cards.filter((card) => card.priority !== "core");

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
                    <p>{formatFxValue(coreCard.currentPrice)}</p>
                    <span>官方数据时间 · {formatOfficialFxTime(coreCard.latestDate)}</span>
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
                  <span>头部价格来源 Twelve Data Time Series (1day)</span>
                  <span>方向口径 {coreCard.symbol}</span>
                </div>
              </article>
            </section>
          ) : null}

          {otherCards.length > 0 ? (
            <section className="card-grid">
              {otherCards.map((card) => (
                <article key={card.symbol} className="index-card">
                  <div className="card-head">
                    <div>
                      <p className="index-code">{card.symbol}</p>
                      <h2>{card.title}</h2>
                      <p className="hero-copy card-copy">{card.description}</p>
                    </div>
                    <div className="headline-metric">
                      <p>{formatFxValue(card.currentPrice)}</p>
                      <span>官方数据时间 · {formatOfficialFxTime(card.latestDate)}</span>
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
                    <span>头部价格来源 Twelve Data Time Series (1day)</span>
                    <span>方向口径 {card.symbol}</span>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
