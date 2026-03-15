import { FundQuarterlyDashboard } from "@/app/components/fund-quarterly-dashboard";
import { SiteMenu } from "@/app/components/site-menu";

export const dynamic = "force-dynamic";

export default function CnFundsPage() {
  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / CN ETF View</p>
          <h1>国内场内基金</h1>
          <p className="hero-copy">
            这里不再把季报页当成高频接口。页面默认只展示本地已保存的解析结果，需要新增或更新某只基金时，再手动输入代码抓取。
          </p>
        </div>
      </section>

      <FundQuarterlyDashboard
        endpoint="/api/cn-funds/quarterly"
        fallbackFundName="国内场内基金"
        loadingTitle="正在读取本地季报记录"
        loadingCopy="页面只读取 SQLite 中已保存的基金季报结果，不会在刷新页面时重新请求证监会披露平台。"
        loadErrorCopy="读取本地基金季报记录失败，请稍后重试。"
        panelTitle="新增或刷新场内基金季报"
        panelCopy="输入 6 位基金代码后，系统会即时抓取证监会最新季报、解析净值表现表，并把结果保存到本地。"
        emptyTitle="本地还没有场内基金季报记录"
        emptyCopy="输入一个 6 位场内基金代码后，系统会抓取并保存最近季报，之后页面刷新只读取本地结果。"
        cardCopy="季报更新是低频行为，这里保留本地解析结果，避免每次打开页面都重新触发远程抓取。"
      />
    </main>
  );
}
