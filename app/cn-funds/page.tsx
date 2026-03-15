import { CnFundQuarterlyList } from "@/app/components/cn-fund-quarterly-list";
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
            本页先做最小验证：固定基金代码，抓取证监会披露平台，展示每只基金最近一次季度报告信息。
          </p>
        </div>
      </section>

      <CnFundQuarterlyList />
    </main>
  );
}
