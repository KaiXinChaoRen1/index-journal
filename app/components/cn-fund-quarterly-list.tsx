"use client";

import { useEffect, useState } from "react";

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
  latestQuarterlyReport: {
    fundCode: string;
    fundId: string;
    title: string;
    publishDate: string;
    detailUrl: string;
    netValuePerformance: string | null;
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
  fromCache?: boolean;
  data: QuarterlyResult[];
};

export function CnFundQuarterlyList() {
  const [data, setData] = useState<QuarterlyResult[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/cn-funds/quarterly", {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`请求失败（HTTP ${response.status}）`);
        }

        const payload = (await response.json()) as QuarterlyApiPayload;
        setData(payload.data ?? []);
        setGeneratedAt(payload.generatedAt ?? null);
        setErrorMessage(null);
      } catch {
        setErrorMessage("获取基金季报数据失败，请稍后重试。");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <section className="empty-state">
        <h2>正在获取基金季报</h2>
        <p>正在请求证监会披露页面，请稍候。</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="empty-state">
        <h2>数据获取失败</h2>
        <p>{errorMessage}</p>
      </section>
    );
  }

  return (
    <section className="card-grid forex-core-grid">
      {data.map((item) => (
        <article key={item.fundCode} className="index-card forex-core-card">
          <div className="card-head">
            <div>
              <p className="index-code">{item.fundCode}</p>
              <h2>{item.fundName ?? "国内场内基金"}</h2>
              <p className="hero-copy card-copy">固定基金代码验证证监会季报链路，不做交易终端式扩展。</p>
            </div>
            <div className="headline-metric">
              <p>{item.status === "success" ? "已获取" : "未获取"}</p>
              <span>{item.message}</span>
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
              {item.latestQuarterlyReport?.netValuePerformanceTable ? (
                <div className="performance-table-wrap">
                  <p className="performance-table-title">基金净值表现 3.2.1（结构化表格）</p>
                  <div className="performance-table-scroll">
                    <table className="performance-table">
                      <thead>
                        <tr>
                          <th>阶段</th>
                          {item.latestQuarterlyReport.netValuePerformanceTable.columns.map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.latestQuarterlyReport.netValuePerformanceTable.rows.map((row) => (
                          <tr key={row.stage}>
                            <td>{row.stage}</td>
                            {row.values.map((value, index) => (
                              <td key={`${row.stage}-${index}`}>{value}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

          {generatedAt ? (
            <div className="card-footer">
              <span>本页抓取时间 {generatedAt.slice(0, 19).replace("T", " ")}</span>
              <span>数据来源 中国证监会公募基金披露平台</span>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
