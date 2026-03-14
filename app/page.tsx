import { MarketChart } from "@/app/components/market-chart";
import { SiteMenu } from "@/app/components/site-menu";
import { ensureStartupCompensation } from "@/lib/dual-track-sync";
import {
  formatDate,
  formatDateOrFallback,
  formatIndexValue,
  formatPercentOrFallback,
  getDefaultMarketCharts,
  getMarketCards,
  getMissingDataMessage,
} from "@/lib/index-data";

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

export default async function HomePage() {
  await ensureStartupCompensation();
  const cards = await getMarketCards();
  const defaultCharts = await getDefaultMarketCharts();

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

      {cards.length === 0 ? (
        <section className="empty-state">
          <h2>暂无数据</h2>
          <p>{getMissingDataMessage()}</p>
          <p>配置好 API Key 后，执行 `npm run setup:data` 初始化数据库并同步 ETF 日线。</p>
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
                <div className="headline-metric">
                  <p>{formatIndexValue(card.currentPrice)}</p>
                  <span>
                    {card.headlineMode === "morning_snapshot" ? "昨夜收盘快照" : "官方EOD"} ·{" "}
                    {card.headlineTime}
                  </span>
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
                <span>头部价格来源 {card.headlineSourceLabel}</span>
                <span>{card.symbol} 作为指数替代追踪</span>
                <span>
                  历史高点 {card.athClose ? formatIndexValue(card.athClose) : "数据不足"} /{" "}
                  {formatDateOrFallback(card.athDate)}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
