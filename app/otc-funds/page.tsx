import { FundQuarterlyDashboard } from "@/app/components/fund-quarterly-dashboard";
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
            场外基金季报同样按低频使用来设计。页面打开时只读本地保存结果，只有手动输入代码或重新抓取时才会请求证监会披露平台。
          </p>
        </div>
      </section>

      <FundQuarterlyDashboard
        endpoint="/api/otc-funds/quarterly"
        fallbackFundName="场外基金"
        loadingTitle="正在读取本地场外基金记录"
        loadingCopy="本页默认只读取 SQLite 中已保存的场外基金季报结果。"
        loadErrorCopy="读取本地场外基金季报记录失败，请稍后重试。"
        panelTitle="新增或刷新场外基金季报"
        panelCopy="输入 6 位场外基金代码后，系统会即时抓取最近季报，并尽量结构化展示多份额净值表现表。"
        emptyTitle="本地还没有场外基金季报记录"
        emptyCopy="输入一个 6 位场外基金代码后，系统会抓取并保存最近季报，适合按低频方式逐步积累跟踪列表。"
        cardCopy="场外基金页保留最近一次解析结果，适合逐只积累 A 类、C 类等多份额季报结构化数据。"
      />
    </main>
  );
}
