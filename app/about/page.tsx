import { SiteMenu } from "@/app/components/site-menu";

// 关于本站：面向"第一次打开、想知道这是什么"的访客。
// 它只回答三件事——这站是什么、覆盖哪些标的、数据来源与口径，
// 不承载开发心得或成长记录（那类自述已在产品化时移除）。
const ABOUT_ENTRIES = [
  {
    title: "这个站点是什么",
    body:
      "Index Journal 是一个聚焦美股核心指数的盘后市场观察面板。它把“盘后快速看懂核心指数位置”这件事收敛成一个克制的页面：一眼看到位置、方向和回撤，而不是堆满按钮的交易终端。",
  },
  {
    title: "覆盖哪些标的",
    body:
      "当前覆盖 S&P 500 与 Nasdaq 100 两个核心指数。为降低授权与维护复杂度，页面用 ETF 近似追踪它们——SPY 近似标普 500、QQQ 近似纳指 100。也就是说，卡片上展示的是 ETF 数据，而非指数本体，二者长期高度贴近但并不完全相等。",
  },
  {
    title: "数据来源与口径",
    body:
      "行情数据来自 Twelve Data。所有阶段涨跌、年化收益、回撤都用统一口径在本地计算，不直接采用第三方现成结论，这样即使将来更换数据源，指标方法学也保持稳定。长期历史落在本地 SQLite。",
  },
  {
    title: "首页头部的两种价格口径",
    body:
      "首页头部价格采用双轨展示：北京时间早晨优先显示“昨夜收盘快照”，便于先看昨晚收盘方向；当天官方日线（官方 EOD）完成后再替换为正式口径，用于长期统计、指标和图表。",
  },
  {
    title: "为什么有手动刷新而非自动轮询",
    body:
      "页面只在用户主动点击时刷新最近价格，并按页面数据组做节流，避免无意义的高频请求。美股指数仅在纽约常规交易时段允许刷新；汇率与 BTC 支持 7×24。这是为了让数据请求可预期、可排障，而不是制造“一直在跳动”的假活跃。",
  },
  {
    title: "基金季报是另一条独立线",
    body:
      "菜单里的“场内基金 / 场外基金”是一条与指数观察相对独立的功能线：它解析中国证监会披露的基金季报，默认只读本地已保存结果，只有手动输入代码时才会重新抓取。它和市场面板共享同一套展示风格，但数据来源、刷新逻辑都不同，所以放在次级菜单而不挤占首页主线。",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / 关于</p>
          <h1>关于本站</h1>
          <p className="hero-copy">
            这个页面解释 Index Journal 是什么、覆盖哪些标的、数据从哪里来、口径如何，
            方便第一次打开或准备自建部署的人快速建立信任。
          </p>
        </div>
      </section>

      <section className="log-grid">
        {ABOUT_ENTRIES.map((entry) => (
          <article key={entry.title} className="log-card">
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
