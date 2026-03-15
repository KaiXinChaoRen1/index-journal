"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

// 这个组件是基金季报页的前端壳层：
// - 首次加载时只读本地 SQLite 已保存结果
// - 用户提交代码或点击“重新抓取”时，才触发后端抓取和落库
type QuarterlyResult = {
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
  latestQuarterlyReport: {
    fundCode: string;
    fundId: string;
    title: string;
    publishDate: string;
    detailUrl: string;
    netValuePerformance: string | null;
    netValuePerformanceTables: Array<{
      className: string | null;
      columns: string[];
      rows: Array<{
        stage: string;
        values: string[];
      }>;
    }>;
    netValuePerformanceTable: {
      columns: string[];
      rows: Array<{
        stage: string;
        values: string[];
      }>;
    } | null;
    netValuePerformanceStatus: string;
  } | null;
};

type QuarterlyApiPayload = {
  generatedAt: string;
  data: QuarterlyResult[];
};

type QuarterlyUpsertPayload = {
  generatedAt: string;
  item: QuarterlyResult;
};

type FundQuarterlyDashboardProps = {
  endpoint: string;
  fallbackFundName: string;
  loadingTitle: string;
  loadingCopy: string;
  loadErrorCopy: string;
  panelTitle: string;
  panelCopy: string;
  emptyTitle: string;
  emptyCopy: string;
  cardCopy: string;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "尚未抓取";
  }

  return value.slice(0, 19).replace("T", " ");
}

function sortQuarterlyResults(items: QuarterlyResult[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.lastFetchedAt ?? left.updatedAt;
    const rightTime = right.lastFetchedAt ?? right.updatedAt;

    return rightTime.localeCompare(leftTime) || left.fundCode.localeCompare(right.fundCode);
  });
}

function upsertQuarterlyResult(items: QuarterlyResult[], incoming: QuarterlyResult) {
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

export function FundQuarterlyDashboard({
  endpoint,
  fallbackFundName,
  loadingTitle,
  loadingCopy,
  loadErrorCopy,
  panelTitle,
  panelCopy,
  emptyTitle,
  emptyCopy,
  cardCopy,
}: FundQuarterlyDashboardProps) {
  const [data, setData] = useState<QuarterlyResult[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [fundCodeInput, setFundCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const response = await fetch(endpoint, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`请求失败（HTTP ${response.status}）`);
        }

        const payload = (await response.json()) as QuarterlyApiPayload;
        setData(sortQuarterlyResults(payload.data ?? []));
        setGeneratedAt(payload.generatedAt ?? null);
        setErrorMessage(null);
      } catch {
        setErrorMessage(loadErrorCopy);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [endpoint, loadErrorCopy]);

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
      throw new Error(getApiErrorMessage(payload, "抓取基金季报失败，请稍后重试。"));
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
      setActionMessage(item.status === "success" ? `已抓取并保存 ${item.fundCode}。` : `${item.fundCode} 已保存，但抓取失败。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "抓取基金季报失败，请稍后重试。");
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
      setActionMessage(item.status === "success" ? `已重新抓取 ${item.fundCode}。` : `${item.fundCode} 已刷新，但抓取失败。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "抓取基金季报失败，请稍后重试。");
    } finally {
      setRefreshingCode(null);
    }
  }

  return (
    <>
      <section className="refresh-panel fund-tool-panel">
        <div className="refresh-panel-head fund-tool-head">
          <div>
            <p className="metric-group-title">本地季报跟踪</p>
            <h2 className="fund-tool-title">{panelTitle}</h2>
            <p className="refresh-note">{panelCopy}</p>
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

        <p className="refresh-meta">
          页面刷新时只读取本地 SQLite 结果。只有你手动新增代码或点击“重新抓取”时，才会重新请求证监会披露平台。
        </p>
        {generatedAt ? <p className="refresh-meta">本页读取时间 {formatTimestamp(generatedAt)}</p> : null}
        {actionMessage ? <p className="refresh-status">{actionMessage}</p> : null}
      </section>

      {isLoading ? (
        <section className="empty-state">
          <h2>{loadingTitle}</h2>
          <p>{loadingCopy}</p>
        </section>
      ) : null}

      {!isLoading && errorMessage ? (
        <section className="empty-state">
          <h2>数据读取失败</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && data.length === 0 ? (
        <section className="empty-state">
          <h2>{emptyTitle}</h2>
          <p>{emptyCopy}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && data.length > 0 ? (
        <section className="card-grid forex-core-grid">
          {data.map((item) => {
            const isRefreshing = refreshingCode === item.fundCode;

            return (
              <article key={item.fundCode} className="index-card forex-core-card">
                <div className="card-head">
                  <div>
                    <p className="index-code">{item.fundCode}</p>
                    <h2>{item.fundName ?? fallbackFundName}</h2>
                    <p className="hero-copy card-copy">{cardCopy}</p>
                  </div>
                  <div className="headline-metric fund-card-headline">
                    <p>{item.status === "success" ? "已保存" : "抓取失败"}</p>
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
                    <p className="metric-group-title">最近季度报告</p>
                    <div className="metric-row">
                      <span>基金代码</span>
                      <strong>{item.fundCode}</strong>
                    </div>
                    <div className="metric-row">
                      <span>基金名称</span>
                      <strong>{item.fundName ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>fundId</span>
                      <strong>{item.fundId ?? "未解析到 fundId"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>基金运作方式</span>
                      <strong>{item.fundOperationMode ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>基金类别</span>
                      <strong>{item.fundCategory ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>基金管理人</span>
                      <strong>{item.fundManager ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>基金托管人</span>
                      <strong>{item.fundCustodian ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>基金合同生效日期</span>
                      <strong>{item.fundContractEffectiveDate ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>本地抓取时间</span>
                      <strong>{formatTimestamp(item.lastFetchedAt)}</strong>
                    </div>
                    <div className="metric-row">
                      <span>季报标题</span>
                      <strong>{item.latestQuarterlyReport?.title ?? "未获取到最近季度报告"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>披露日期</span>
                      <strong>{item.latestQuarterlyReport?.publishDate ?? "暂无数据"}</strong>
                    </div>
                    <div className="metric-row">
                      <span>查看原文</span>
                      <strong>
                        {item.latestQuarterlyReport?.detailUrl ? (
                          <a href={item.latestQuarterlyReport.detailUrl} target="_blank" rel="noreferrer">
                            打开季报
                          </a>
                        ) : (
                          "暂无链接"
                        )}
                      </strong>
                    </div>
                    {item.latestQuarterlyReport?.netValuePerformanceTables &&
                    item.latestQuarterlyReport.netValuePerformanceTables.length > 0 ? (
                      <div className="performance-table-wrap">
                        <p className="performance-table-title">基金净值表现 3.2.1（结构化表格）</p>
                        {item.latestQuarterlyReport.netValuePerformanceTables.map((table, tableIndex) => (
                          <div key={`${item.fundCode}-perf-${tableIndex}`} className="performance-table-block">
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
                        ))}
                      </div>
                    ) : (
                      <div className="metric-row">
                        <span>基金净值表现 3.2.1（结构化表格）</span>
                        <strong>{item.latestQuarterlyReport?.netValuePerformance ?? "未提取到净值表现"}</strong>
                      </div>
                    )}
                    <div className="metric-row">
                      <span>净值表现解析状态</span>
                      <strong>{item.latestQuarterlyReport?.netValuePerformanceStatus ?? "暂无报告可解析"}</strong>
                    </div>
                  </div>
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
