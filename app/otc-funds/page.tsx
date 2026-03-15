import { OtcFundQuarterlyList } from "@/app/components/otc-fund-quarterly-list";
import { SiteMenu } from "@/app/components/site-menu";

export const dynamic = "force-dynamic";

export default function OtcFundsPage() {
  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / OTC Fund View</p>
          <h1>场外基金</h1>
          <p className="hero-copy">
            本页使用固定场外基金代码，抓取最近季报并结构化展示净值表现 3.2.1 表格，尽量完整覆盖 A 类、C 类及更多份额类型。
          </p>
        </div>
      </section>

      <OtcFundQuarterlyList />
    </main>
  );
}
