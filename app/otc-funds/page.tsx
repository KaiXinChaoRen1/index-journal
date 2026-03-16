import { FUND_QUARTERLY_KIND, listStoredFundQuarterlies, type StoredFundQuarterlyResult } from "@/lib/cn-fund-quarterly";
import { FundQuarterlyDashboard } from "@/app/components/fund-quarterly-dashboard";
import { SiteMenu } from "@/app/components/site-menu";

export const dynamic = "force-dynamic";

export default async function OtcFundsPage() {
  let initialData: StoredFundQuarterlyResult[] = [];
  let initialGeneratedAt: string | null = null;
  let initialErrorMessage: string | null = null;

  try {
    const result = await listStoredFundQuarterlies(FUND_QUARTERLY_KIND.otc);
    initialData = result.data;
    initialGeneratedAt = result.generatedAt;
  } catch {
    initialErrorMessage = "读取场外基金记录失败，请稍后重试。";
  }

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / OTC Fund View</p>
          <h1>场外基金（支付宝等）</h1>
          <p className="hero-copy">整理自己会长期跟踪的场外基金季报与多份额净值表现。</p>
        </div>
      </section>

      <FundQuarterlyDashboard
        endpoint="/api/otc-funds/quarterly"
        initialData={initialData}
        initialGeneratedAt={initialGeneratedAt}
        initialErrorMessage={initialErrorMessage}
        fallbackFundName="场外基金"
        panelTitle="新增或更新场外基金"
        emptyTitle="本地还没有场外基金季报记录"
        emptyCopy="输入一个 6 位基金代码后，这里会开始积累你关心的场外基金季报。"
        cardCopy="保留最近一次整理结果，方便回看基金信息与多份额净值表现。"
      />
    </main>
  );
}
