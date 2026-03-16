import { FUND_QUARTERLY_KIND, listStoredFundQuarterlies, type StoredFundQuarterlyResult } from "@/lib/cn-fund-quarterly";
import { FundQuarterlyDashboard } from "@/app/components/fund-quarterly-dashboard";
import { SiteMenu } from "@/app/components/site-menu";

export const dynamic = "force-dynamic";

export default async function CnFundsPage() {
  let initialData: StoredFundQuarterlyResult[] = [];
  let initialGeneratedAt: string | null = null;
  let initialErrorMessage: string | null = null;

  try {
    const result = await listStoredFundQuarterlies(FUND_QUARTERLY_KIND.cn);
    initialData = result.data;
    initialGeneratedAt = result.generatedAt;
  } catch {
    initialErrorMessage = "读取场内基金记录失败，请稍后重试。";
  }

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <SiteMenu />
      </header>

      <section className="subpage-hero">
        <div>
          <p className="eyebrow">Index Journal / CN ETF View</p>
          <h1>场内基金（证券账户）</h1>
          <p className="hero-copy">整理自己会长期跟踪的场内基金季报与净值表现。</p>
        </div>
      </section>

      <FundQuarterlyDashboard
        endpoint="/api/cn-funds/quarterly"
        initialData={initialData}
        initialGeneratedAt={initialGeneratedAt}
        initialErrorMessage={initialErrorMessage}
        fallbackFundName="场内基金"
        panelTitle="新增或更新场内基金"
        emptyTitle="本地还没有场内基金季报记录"
        emptyCopy="输入一个 6 位基金代码后，这里会开始积累你关心的场内基金季报。"
        cardCopy="保留最近一次整理结果，方便回看基金信息与净值表现。"
      />
    </main>
  );
}
