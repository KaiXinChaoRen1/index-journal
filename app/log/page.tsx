import { SiteMenu } from "@/app/components/site-menu";
import { isMarketConfigured } from "@/lib/index-data";

const LOG_ENTRIES = [
  {
    title: "它是一次真实的 AI 协作开发实践",
    body:
      "Index Journal 的第一层价值，不只是把一个页面做出来，而是让我真实经历“有一个想法，然后与 AI agent 对话，再一起把它做成产品”的过程。这里保留设计判断、协作痕迹和可复盘的上下文。",
  },
  {
    title: "它也是一份技术学习样本",
    body:
      "这个项目刻意采用了我工作主栈之外的技术组合。它既是一个可运行的应用，也是我理解 Next.js、TypeScript、Prisma 以及 AI 协作式开发方法的实践样本，所以代码和文档都强调“能读懂、可回看”。",
  },
  {
    title: "它服务一个真实且持续的个人需求",
    body:
      "我长期关注指数投资，所以这不是一份假练习。它要能让我每天打开自己的站点，快速看到市场位置、区间变化和长期表现，替代在手机 App 里临时翻找数据的行为。",
  },
  {
    title: "它最终想成为一份长期数字作品",
    body:
      "这个项目未来不仅记录指数数据，也会逐步承载开发日志、设计取舍、投资阅读和市场思考。它既是工具，也是作品，所以既要实用，也要保留表达性、结构感和长期生长空间。",
  },
] as const;

export default function DevelopmentLogPage() {
  const showDevStatus = process.env.NODE_ENV === "development";
  const isConfigured = isMarketConfigured();

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / Product Notes</p>
          <h1>开发日志</h1>
          <p className="hero-copy">
            这里记录这个项目为什么存在、为什么这样设计，以及它未来想往哪里长。它不是首页主视觉的一部分，
            但它决定了这个项目会不会只是一次性 demo。
          </p>
        </div>
      </section>

      <section className="log-grid">
        {LOG_ENTRIES.map((entry) => (
          <article key={entry.title} className="log-card">
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
          </article>
        ))}
      </section>

      <section className="log-note-card">
        <p className="metric-group-title">界面小注</p>
        <h2>为什么叫“汉堡图标”</h2>
        <p>
          左上角这个三条横线的导航入口，常被叫作 hamburger icon，是因为它的外形很像汉堡的上下面包和中间夹层。
          它在数字产品里经常被拿来承载导航，但也一直伴随一个老问题：把入口藏起来，会不会让信息层级变得更难发现。
        </p>
        <p>
          在 Index Journal 里继续使用它，是因为当前站点页面很少，确实适合一个轻量入口；但我们也刻意把它做得更像头部导航的一部分，
          而不是一个神秘的小按钮，避免它既隐藏信息，又显得过于突兀。
        </p>
      </section>

      {showDevStatus ? (
        <section className="dev-status-panel">
          <p className="metric-group-title">开发态信息</p>
          <div className="dev-status-grid">
            <div className="dev-status-item">
              <span>运行模式</span>
              <strong>{process.env.NODE_ENV}</strong>
            </div>
            <div className="dev-status-item">
              <span>数据接入</span>
              <strong>{isConfigured ? "已检测到 TWELVE_DATA_API_KEY" : "尚未检测到 TWELVE_DATA_API_KEY"}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
