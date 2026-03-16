"use client";

import type { FormEvent } from "react";
import { useState } from "react";

// 报告条目类型
type ReportItem = {
  title: string;
  publishDate: string;
  detailUrl: string;
  netValuePerformanceTables: Array<{
    className: string | null;
    columns: string[];
    rows: Array<{ stage: string; values: string[] }>;
  }>;
  netValuePerformanceStatus: string;
};

// 基金报告结果类型（新结构）
type FundReportsResult = {
  fundCode: string;
  fundId: string | null;
  fundName: string | null;
  fundOperationMode: string | null;
  fundCategory: string | null;
  fundManager: string | null;
  fundCustodian: string | null;
  fundContractEffectiveDate: string | null;
  status: "success" | "failed";
  message: string;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reports: {
    quarterly: ReportItem[];
    annual: ReportItem[];
  };
};

type QuarterlyUpsertPayload = {
  generatedAt: string;
  item: FundReportsResult;
};

type FundQuarterlyDashboardProps = {
  endpoint: string;
  initialData: FundReportsResult[];
  initialGeneratedAt: string | null;
  initialErrorMessage?: string | null;
  fallbackFundName: string;
  panelTitle: string;
  emptyTitle: string;
  emptyCopy: string;
  cardCopy: string;
};

// 构建证监会基金详情页链接
function buildCsrcFundUrl(fundId: string | null) {
  if (!fundId) return "http://eid.csrc.gov.cn/fund/disclose/index.html";
  return `http://eid.csrc.gov.cn/fund/disclose/fund_detail.do?fundId=${fundId}`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "尚未抓取";
  }

  return value.slice(0, 19).replace("T", " ");
}

function sortQuarterlyResults(items: FundReportsResult[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.lastFetchedAt ?? left.updatedAt;
    const rightTime = right.lastFetchedAt ?? right.updatedAt;

    return rightTime.localeCompare(leftTime) || left.fundCode.localeCompare(right.fundCode);
  });
}

function upsertQuarterlyResult(items: FundReportsResult[], incoming: FundReportsResult) {
  const next = items.filter((item) => item.fundCode !== incoming.fundCode);
  next.unshift(incoming);
  return sortQuarterlyResults(next);
}

function getApiErrorMessage(payload: unknown, fallbackMessage: string) {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  const { message } = payload as { message?: unknown };
  return typeof message === "string" && message.trim() ? message : fallbackMessage;
}

function isValidFundCode(value: string) {
  return /^\d{6}$/.test(value.trim());
}

// 单份业绩数据表格组件
function PerformanceTable({
  table,
  tableIndex,
}: {
  table: ReportItem["netValuePerformanceTables"][0];
  tableIndex: number;
}) {
  return (
    <div className="performance-table-block">
      <p className="performance-table-subtitle">{table.className ?? `份额组 ${tableIndex + 1}`}</p>
      <div className="performance-table-scroll">
        <table className="performance-table">
          <thead>
            <tr>
              <th>阶段</th>
              {table.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${tableIndex}-${row.stage}`}>
                <td>{row.stage}</td>
                {row.values.map((value, index) => (
                  <td key={`${tableIndex}-${row.stage}-${index}`}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 单份报告卡片组件
function ReportCard({ report, fundCode }: { report: ReportItem; fundCode: string }) {
  const [showPerformance, setShowPerformance] = useState(false);

  return (
    <div className="report-card">
      <div className="report-card-header">
        <a href={report.detailUrl} target="_blank" rel="noreferrer" className="report-title">
          {report.title}
        </a>
        <span className="report-date">{report.publishDate}</span>
      </div>

      <button
        type="button"
        className="report-toggle-btn"
        onClick={() => setShowPerformance(!showPerformance)}
      >
        {showPerformance ? "▼ 隐藏业绩数据" : "▶ 查看业绩数据"}
      </button>

      {showPerformance && (
        <div className="report-performance">
          {report.netValuePerformanceTables.length > 0 ? (
            <div className="performance-table-wrap">
              <p className="performance-table-title">基金净值表现 3.2.1（结构化表格）</p>
              {report.netValuePerformanceTables.map((table, idx) => (
                <PerformanceTable key={`${fundCode}-${idx}`} table={table} tableIndex={idx} />
              ))}
            </div>
          ) : (
            <div className="report-performance-empty">{report.netValuePerformanceStatus}</div>
          )}
        </div>
      )}
    </div>
  );
}

// 报告分类折叠区域组件
function ReportSection({
  title,
  reports,
  sourceUrl,
}: {
  title: string;
  reports: ReportItem[];
  sourceUrl: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="report-section">
      <div className="report-section-header">
        <button
          type="button"
          className="report-section-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="report-section-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="report-section-title">
            {title} ({reports.length})
          </span>
        </button>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="report-section-link"
        >
          查看官方数据源
        </a>
      </div>

      {isExpanded && (
        <div className="report-list">
          {reports.length === 0 ? (
            <div className="report-list-empty">暂无{title}数据</div>
          ) : (
            reports.map((report, index) => (
              <ReportCard key={`${report.title}-${index}`} report={report} fundCode="" />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// 基金信息行组件
function FundInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value ?? "暂无数据"}</strong>
    </div>
  );
}

export function FundQuarterlyDashboard({
  endpoint,
  initialData,
  initialGeneratedAt,
  initialErrorMessage = null,
  fallbackFundName,
  panelTitle,
  emptyTitle,
  emptyCopy,
  cardCopy,
}: FundQuarterlyDashboardProps) {
  const [data, setData] = useState<FundReportsResult[]>(() => sortQuarterlyResults(initialData));
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt);
  const [fundCodeInput, setFundCodeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function saveFundCode(fundCode: string) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ fundCode }),
    });

    const payload = (await response.json()) as QuarterlyUpsertPayload | { message?: string };

    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload, "抓取基金报告失败，请稍后重试。"));
    }

    const successPayload = payload as QuarterlyUpsertPayload;
    setData((current) => upsertQuarterlyResult(current, successPayload.item));
    setGeneratedAt(successPayload.generatedAt ?? successPayload.item.lastFetchedAt ?? new Date().toISOString());

    return successPayload.item;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedFundCode = fundCodeInput.trim();

    if (!isValidFundCode(normalizedFundCode)) {
      setActionMessage("请输入 6 位基金代码。");
      return;
    }

    try {
      setIsSubmitting(true);
      setActionMessage(null);
      const item = await saveFundCode(normalizedFundCode);
      setFundCodeInput("");
      setErrorMessage(null);
      setActionMessage(`已抓取并保存 ${item.fundCode}。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "抓取基金报告失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefresh(fundCode: string) {
    try {
      setRefreshingCode(fundCode);
      setActionMessage(null);
      const item = await saveFundCode(fundCode);
      setErrorMessage(null);
      setActionMessage(`已重新抓取 ${item.fundCode}。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "抓取基金报告失败，请稍后重试。");
    } finally {
      setRefreshingCode(null);
    }
  }

  return (
    <>
      <section className="refresh-panel fund-tool-panel">
        <div className="refresh-panel-head fund-tool-head">
          <div>
            <p className="metric-group-title">基金季报</p>
            <h2 className="fund-tool-title">{panelTitle}</h2>
          </div>

          <form className="fund-code-form" onSubmit={handleSubmit}>
            <label className="fund-code-label" htmlFor={`${endpoint}-fund-code`}>
              基金代码
            </label>
            <div className="fund-code-control">
              <input
                id={`${endpoint}-fund-code`}
                className="fund-code-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="例如 513100"
                value={fundCodeInput}
                onChange={(event) => setFundCodeInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isSubmitting || Boolean(refreshingCode)}
              />
              <button
                type="submit"
                className={isSubmitting ? "refresh-button pending" : "refresh-button"}
                disabled={isSubmitting || Boolean(refreshingCode)}
              >
                {isSubmitting ? "抓取中..." : "新增并抓取"}
              </button>
            </div>
          </form>
        </div>

        {generatedAt ? <p className="refresh-meta">最近读取时间 {formatTimestamp(generatedAt)}</p> : null}
        {actionMessage ? <p className="refresh-status">{actionMessage}</p> : null}
      </section>

      {errorMessage ? (
        <section className="empty-state">
          <h2>数据读取失败</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage && data.length === 0 ? (
        <section className="empty-state">
          <h2>{emptyTitle}</h2>
          <p>{emptyCopy}</p>
        </section>
      ) : null}

      {!errorMessage && data.length > 0 ? (
        <section className="card-grid forex-core-grid">
          {data.map((item) => {
            const isRefreshing = refreshingCode === item.fundCode;
            const sourceUrl = buildCsrcFundUrl(item.fundId);

            return (
              <article key={item.fundCode} className="index-card forex-core-card">
                <div className="card-head">
                  <div>
                    <p className="index-code">{item.fundCode}</p>
                    <h2>{item.fundName ?? fallbackFundName}</h2>
                    <p className="hero-copy card-copy">{cardCopy}</p>
                  </div>
                  <div className="headline-metric fund-card-headline">
                    <p>已保存</p>
                    <span>{item.message}</span>
                    <button
                      type="button"
                      className={isRefreshing ? "refresh-button pending fund-card-button" : "refresh-button fund-card-button"}
                      onClick={() => void handleRefresh(item.fundCode)}
                      disabled={isSubmitting || Boolean(refreshingCode)}
                    >
                      {isRefreshing ? "抓取中..." : "重新抓取"}
                    </button>
                  </div>
                </div>

                <div className="metric-table">
                  <div className="metric-group">
                    <p className="metric-group-title">基金基本信息</p>
                    <FundInfoRow label="基金代码" value={item.fundCode} />
                    <FundInfoRow label="基金名称" value={item.fundName} />
                    <FundInfoRow label="本地抓取时间" value={formatTimestamp(item.lastFetchedAt)} />
                  </div>

                  {/* 季报区域 */}
                  <ReportSection
                    title="季报"
                    reports={item.reports.quarterly}
                    sourceUrl={sourceUrl}
                  />

                  {/* 年报区域 */}
                  <ReportSection
                    title="年报"
                    reports={item.reports.annual}
                    sourceUrl={sourceUrl}
                  />
                </div>

                <div className="card-footer">
                  <span>本地更新时间 {formatTimestamp(item.updatedAt)}</span>
                  <span>数据来源 中国证监会公募基金披露平台</span>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
