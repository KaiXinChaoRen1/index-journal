import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";

const CSRC_VALIDATE_URL = "http://eid.csrc.gov.cn/fund/disclose/validate_fund.do";
const CSRC_FUND_DETAIL_URL = "http://eid.csrc.gov.cn/fund/disclose/fund_detail.do";
const CSRC_ORIGIN = "http://eid.csrc.gov.cn";
const REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/**
 * 基金季报服务层。
 *
 * 这一层同时承担三件事：
 * 1. 向证监会披露平台请求基金详情与季报正文
 * 2. 解析“3.2.1 基金净值表现”段落
 * 3. 把最近一次结果保存到 SQLite
 *
 * 当前规模下这样集中放置是可维护的，但如果未来基金能力继续变复杂，
 * 最优先的演化方向就是把“抓取 / 解析 / 存储”拆成独立子模块。
 */
export const FUND_QUARTERLY_KIND = {
  cn: "cn",
  otc: "otc",
} as const;

export type FundQuarterlyKind = (typeof FUND_QUARTERLY_KIND)[keyof typeof FUND_QUARTERLY_KIND];

type NetValuePerformanceRow = {
  stage: string;
  values: string[];
};

type NetValuePerformanceTable = {
  className: string | null;
  columns: string[];
  rows: NetValuePerformanceRow[];
};

export type QuarterlyReportItem = {
  fundCode: string;
  fundId: string;
  title: string;
  publishDate: string;
  detailUrl: string;
  netValuePerformance: string | null;
  netValuePerformanceTables: NetValuePerformanceTable[];
  netValuePerformanceTable: {
    columns: string[];
    rows: NetValuePerformanceRow[];
  } | null;
  netValuePerformanceStatus: string;
};

export type FundQuarterlyResult = {
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
  latestQuarterlyReport: QuarterlyReportItem | null;
};

export type StoredFundQuarterlyResult = FundQuarterlyResult & {
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredFundQuarterlyListPayload = {
  generatedAt: string;
  data: StoredFundQuarterlyResult[];
};

type FundIdLookupResult =
  | {
      ok: true;
      fundId: string;
    }
  | {
      ok: false;
      message: string;
    };

function normalizeText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDocumentText(value: string) {
  return value
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFundCodeInput(value: string) {
  return value.trim();
}

export function isValidFundCode(value: string) {
  return /^\d{6}$/.test(normalizeFundCodeInput(value));
}

function buildFailedResult(fundCode: string, message: string): FundQuarterlyResult {
  return {
    fundCode,
    fundId: null,
    fundName: null,
    fundOperationMode: null,
    fundCategory: null,
    fundManager: null,
    fundCustodian: null,
    fundContractEffectiveDate: null,
    status: "failed",
    message,
    latestQuarterlyReport: null,
  };
}

export function isQuarterReport(title: string) {
  if (title.includes("年度报告") || title.includes("半年度报告")) {
    return false;
  }

  if (title.includes("季度报告")) {
    return true;
  }

  return /第[一二三四1-4]季度报告/.test(title) || /[1-4]季度报告/.test(title);
}

function extractFundName(html: string) {
  const headingMatch = html.match(
    /<td[^>]*class="title_tu"[^>]*>\s*([\s\S]*?)\s*\((\d{6})\)\s*<\/td>/i,
  );

  if (!headingMatch) {
    return null;
  }

  const candidate = normalizeText(headingMatch[1]);
  return candidate || null;
}

function extractFundCodeFromDetail(html: string, fallbackFundCode: string) {
  const codeInTitle = html.match(/\((\d{6})\)/);

  if (codeInTitle) {
    return codeInTitle[1];
  }

  const codeInQuery = html.match(/fundCode=(\d{6})/i);
  if (codeInQuery) {
    return codeInQuery[1];
  }

  return fallbackFundCode;
}

function extractFieldByLabel(html: string, label: string) {
  const pattern = new RegExp(
    `<td[^>]*>\\s*${escapeRegex(label)}\\s*</td>[\\s\\S]*?<td[^>]*>\\s*([\\s\\S]*?)\\s*</td>`,
    "i",
  );
  const match = html.match(pattern);

  if (!match) {
    return null;
  }

  const value = normalizeText(match[1]);
  return value.length > 0 ? value : null;
}

function extractFundOverview(html: string, fallbackFundCode: string) {
  const fundName = extractFundName(html);
  const fundCode = extractFundCodeFromDetail(html, fallbackFundCode);

  return {
    fundName,
    fundCode,
    fundOperationMode: extractFieldByLabel(html, "基金运作方式"),
    fundCategory: extractFieldByLabel(html, "基金类别"),
    fundManager: extractFieldByLabel(html, "基金管理人"),
    fundCustodian: extractFieldByLabel(html, "基金托管人"),
    fundContractEffectiveDate: extractFieldByLabel(html, "基金合同生效日期"),
  };
}

function extractQuarterlyReports(html: string, fundCode: string, fundId: string) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const reports: QuarterlyReportItem[] = [];

  for (const row of rows) {
    const rowHtml = row[1];
    const anchorMatch = rowHtml.match(
      /<a[^>]*href="([^"]*instance_show_[^"]*?instanceid=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/i,
    );

    if (!anchorMatch) {
      continue;
    }

    const title = normalizeText(anchorMatch[2]);

    if (!isQuarterReport(title)) {
      continue;
    }

    const publishDateMatch = rowHtml.match(/\d{4}-\d{2}-\d{2}/);
    if (!publishDateMatch) {
      continue;
    }

    reports.push({
      fundCode,
      fundId,
      title,
      publishDate: publishDateMatch[0],
      detailUrl: new URL(anchorMatch[1], `${CSRC_ORIGIN}/fund/disclose/`).toString(),
      netValuePerformance: null,
      netValuePerformanceTables: [],
      netValuePerformanceTable: null,
      netValuePerformanceStatus: "未解析季报正文。",
    });
  }

  return reports.sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}

function isLikelyBlockedPage(html: string) {
  return html.includes("<title>405</title>") || html.includes("errors.aliyun.com");
}

function detectReportFormat(detailUrl: string, contentType: string | null) {
  const loweredType = (contentType ?? "").toLowerCase();
  const loweredUrl = detailUrl.toLowerCase();

  if (loweredType.includes("pdf") || loweredUrl.endsWith(".pdf") || loweredUrl.includes("instance_show_pdf_id")) {
    return "pdf";
  }

  if (
    loweredType.includes("officedocument.wordprocessingml.document") ||
    loweredUrl.endsWith(".docx") ||
    loweredType.includes("msword") ||
    loweredUrl.endsWith(".doc")
  ) {
    return "word";
  }

  return "unknown";
}

async function parseReportText(detailUrl: string) {
  try {
    const response = await fetch(detailUrl, {
      headers: REQUEST_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        text: null,
        message: `报告下载失败（HTTP ${response.status}）。`,
      };
    }

    const fileType = detectReportFormat(detailUrl, response.headers.get("content-type"));
    const buffer = Buffer.from(await response.arrayBuffer());

    if (fileType === "pdf") {
      const pdfParseModule = (await import("pdf-parse/lib/pdf-parse.js")) as {
        default?: (buffer: Buffer) => Promise<{ text: string }>;
      };
      const pdfParse = pdfParseModule.default ?? (pdfParseModule as unknown as (buffer: Buffer) => Promise<{ text: string }>);
      const parsed = await pdfParse(buffer);
      return {
        text: normalizeDocumentText(parsed.text),
        message: "已解析 PDF 季报正文。",
      };
    }

    if (fileType === "word") {
      const parsed = await mammoth.extractRawText({ buffer });
      return {
        text: normalizeDocumentText(parsed.value ?? ""),
        message: "已解析 Word 季报正文。",
      };
    }

    return {
      text: null,
      message: "报告格式暂不支持自动解析。",
    };
  } catch (error) {
    return {
      text: null,
      message: `季报正文解析失败：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

function extractClassMarkers(compactSection: string) {
  const patterns = [
    /([A-Z])类(?:基金)?份额?[：:]?阶段?净值增长率/g,
    /([A-Z])类(?:基金)?份额?净值增长率/g,
    /([A-Z])份额[：:]?阶段?净值增长率/g,
    /([A-Z])[：:]?阶段净值增长率/g,
  ];
  const markerMap = new Map<number, { className: string; start: number }>();

  for (const pattern of patterns) {
    for (const match of compactSection.matchAll(pattern)) {
      const start = match.index ?? -1;
      if (start < 0) {
        continue;
      }

      markerMap.set(start, {
        className: `${match[1]}类`,
        start,
      });
    }
  }

  return [...markerMap.values()].sort((left, right) => left.start - right.start);
}

function extractNetValuePerformanceText(text: string) {
  if (!text) {
    return {
      text: null,
      tables: [],
      table: null,
    };
  }

  const startMatches = [...text.matchAll(/3\.2\.1/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);
  if (startMatches.length === 0) {
    const fallbackStart = text.indexOf("净值增长率及其与同期业绩比较基准收益率的比较");
    if (fallbackStart >= 0) {
      startMatches.push(fallbackStart);
    }
  }

  if (startMatches.length === 0) {
    return {
      text: null,
      tables: [],
      table: null,
    };
  }

  const lineBreakMarkers = [
    "阶段",
    "净值增长率①",
    "净值增长率标准差②",
    "业绩比较基准收益率③",
    "业绩比较基准收益率标准差④",
    "①-③",
    "②-④",
    "过去三个月",
    "过去六个月",
    "过去一年",
    "过去三年",
    "过去五年",
    "自基金合同生效起至今",
  ];
  const columns = ["净值增长率①", "净值增长率标准差②", "业绩比较基准收益率③", "业绩比较基准收益率标准差④", "①-③", "②-④"];
  const rowDefs: Array<{ label: string; pattern: string }> = [
    { label: "过去三个月", pattern: "(?:过去三个月|过去三月)" },
    { label: "过去六个月", pattern: "(?:过去六个月|过去六月)" },
    { label: "过去一年", pattern: "过去一年" },
    { label: "过去三年", pattern: "过去三年" },
    { label: "过去五年", pattern: "过去五年" },
    { label: "自基金合同生效起至今", pattern: "自基金合同生效起" },
  ];
  const parsedTables: Array<{
    className: string | null;
    text: string;
    columns: string[];
    rows: NetValuePerformanceRow[];
  }> = [];
  const tokenPattern = /[-+]?\d[\d,]*(?:\.\d+)?%|-/g;
  const parseRows = (compactSection: string) => {
    const rowStarts = rowDefs
      .map((row) => {
        const match = compactSection.match(new RegExp(row.pattern));
        return {
          ...row,
          start: match ? match.index ?? -1 : -1,
          hit: match ? match[0] : null,
        };
      })
      .filter((row) => row.start >= 0)
      .sort((a, b) => a.start - b.start);
    const rows: NetValuePerformanceRow[] = [];

    for (let index = 0; index < rowStarts.length; index += 1) {
      const current = rowStarts[index];
      const next = rowStarts[index + 1];
      const segment = compactSection.slice(current.start, next ? next.start : compactSection.length);
      const segmentWithoutLabel = current.hit ? segment.slice(current.hit.length) : segment;
      const tokens = segmentWithoutLabel.match(tokenPattern) ?? [];
      const values = tokens.slice(0, 6);

      if (values.length > 0) {
        while (values.length < 6) {
          values.push("-");
        }
        rows.push({
          stage: current.label,
          values,
        });
      }
    }

    return rows;
  };

  for (let i = 0; i < startMatches.length; i += 1) {
    const start = startMatches[i];
    const nextStart = startMatches[i + 1] ?? -1;
    const endCandidates = [text.indexOf("3.2.2", start), text.indexOf("3.3", start), text.indexOf("§4", start), nextStart]
      .filter((value) => value > start)
      .sort((a, b) => a - b);
    const end = endCandidates[0] ?? Math.min(text.length, start + 2200);
    const section = normalizeDocumentText(text.slice(start, end));

    if (!section) {
      continue;
    }

    let formatted = section;
    for (const marker of lineBreakMarkers) {
      formatted = formatted.replace(new RegExp(escapeRegex(marker), "g"), `\n${marker}`);
    }
    formatted = formatted
      .replace(/3\.2\.1/g, "\n3.2.1")
      .replace(/\n+/g, "\n")
      .trim();

    const outputText = formatted.slice(0, 6000);
    const compact = formatted.replace(/\s+/g, "");
    const classMatches = extractClassMarkers(compact);

    if (classMatches.length >= 2) {
      for (let classIndex = 0; classIndex < classMatches.length; classIndex += 1) {
        const currentClass = classMatches[classIndex];
        const nextClass = classMatches[classIndex + 1];
        const classSegment = compact.slice(currentClass.start, nextClass ? nextClass.start : compact.length);
        const rows = parseRows(classSegment);

        if (rows.length > 0) {
          parsedTables.push({
            className: currentClass.className,
            text: outputText,
            columns,
            rows,
          });
        }
      }
    } else {
      const rows = parseRows(compact);
      const className = classMatches[0]?.className ?? null;
      if (rows.length > 0) {
        parsedTables.push({
          className,
          text: outputText,
          columns,
          rows,
        });
      }
    }
  }

  if (parsedTables.length === 0) {
    return {
      text: null,
      tables: [],
      table: null,
    };
  }

  return {
    text: [...new Set(parsedTables.map((table) => table.text))].join("\n\n"),
    tables: parsedTables.map((table) => ({
      className: table.className,
      columns: table.columns,
      rows: table.rows,
    })),
    table: {
      columns: parsedTables[0].columns,
      rows: parsedTables[0].rows,
    },
  };
}

async function enrichLatestQuarterlyReportWithNetValue(item: QuarterlyReportItem) {
  const parsed = await parseReportText(item.detailUrl);

  if (!parsed.text) {
    return {
      ...item,
      netValuePerformance: null,
      netValuePerformanceTables: [],
      netValuePerformanceTable: null,
      netValuePerformanceStatus: parsed.message,
    };
  }

  const netValuePerformance = extractNetValuePerformanceText(parsed.text);

  if (!netValuePerformance.text) {
    return {
      ...item,
      netValuePerformance: null,
      netValuePerformanceTables: [],
      netValuePerformanceTable: null,
      netValuePerformanceStatus: "已解析季报正文，但未定位到基金净值表现段落。",
    };
  }

  return {
    ...item,
    netValuePerformance: netValuePerformance.text,
    netValuePerformanceTables: netValuePerformance.tables,
    netValuePerformanceTable: netValuePerformance.table,
    netValuePerformanceStatus: parsed.message,
  };
}

export async function getFundIdByCode(fundCode: string): Promise<FundIdLookupResult> {
  try {
    // 真实基金代码不能直接当详情页参数，必须先通过校验接口换取内部 fundId。
    const body = new URLSearchParams();
    body.set("cFundCode", fundCode);

    const response = await fetch(CSRC_VALIDATE_URL, {
      method: "POST",
      headers: {
        ...REQUEST_HEADERS,
        accept: "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        referer: `${CSRC_ORIGIN}/fund/index.html`,
      },
      body: body.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `基金代码查询失败（HTTP ${response.status}）。`,
      };
    }

    const payload = (await response.json()) as {
      isSuccess?: boolean;
      fundId?: number | string;
    };

    if (!payload.isSuccess || payload.fundId === undefined || payload.fundId === null) {
      return {
        ok: false,
        message: "未解析到 fundId。",
      };
    }

    return {
      ok: true,
      fundId: String(payload.fundId),
    };
  } catch {
    return {
      ok: false,
      message: "查询 fundId 失败，请稍后重试。",
    };
  }
}

async function fetchFundDetailById(fundId: string) {
  const url = new URL(CSRC_FUND_DETAIL_URL);
  url.searchParams.set("fundId", fundId);

  try {
    const response = await fetch(url.toString(), {
      headers: REQUEST_HEADERS,
      cache: "no-store",
    });

    const html = await response.text();

    if (!response.ok || isLikelyBlockedPage(html)) {
      return null;
    }

    return html;
  } catch {
    return null;
  }
}

export async function fetchFundLatestQuarterly(fundCode: string): Promise<FundQuarterlyResult> {
  const normalizedFundCode = normalizeFundCodeInput(fundCode);

  if (!isValidFundCode(normalizedFundCode)) {
    return buildFailedResult(normalizedFundCode || fundCode, "基金代码需为 6 位数字。");
  }

  const fundIdResult = await getFundIdByCode(normalizedFundCode);

  if (!fundIdResult.ok) {
    return buildFailedResult(normalizedFundCode, fundIdResult.message);
  }

  const fundId = fundIdResult.fundId;
  const html = await fetchFundDetailById(fundId);

  if (!html) {
    return {
      ...buildFailedResult(normalizedFundCode, "未获取到有效详情页。"),
      fundId,
    };
  }

  if (!html.includes("资本市场统一信息披露平台")) {
    return {
      ...buildFailedResult(normalizedFundCode, "详情页内容无效。"),
      fundId,
    };
  }

  const overview = extractFundOverview(html, normalizedFundCode);
  const resolvedFundCode = overview.fundCode;
  const reports = extractQuarterlyReports(html, resolvedFundCode, fundId);

  if (reports.length === 0) {
    return {
      fundCode: resolvedFundCode,
      fundId,
      fundName: overview.fundName,
      fundOperationMode: overview.fundOperationMode,
      fundCategory: overview.fundCategory,
      fundManager: overview.fundManager,
      fundCustodian: overview.fundCustodian,
      fundContractEffectiveDate: overview.fundContractEffectiveDate,
      status: "failed",
      message: "未获取到最近季度报告。",
      latestQuarterlyReport: null,
    };
  }

  return {
    fundCode: resolvedFundCode,
    fundId,
    fundName: overview.fundName,
    fundOperationMode: overview.fundOperationMode,
    fundCategory: overview.fundCategory,
    fundManager: overview.fundManager,
    fundCustodian: overview.fundCustodian,
    fundContractEffectiveDate: overview.fundContractEffectiveDate,
    status: "success",
    message: "已获取最近季度报告。",
    latestQuarterlyReport: await enrichLatestQuarterlyReportWithNetValue(reports[0]),
  };
}

function createStoredFallbackResult(fundCode: string, message: string): StoredFundQuarterlyResult {
  const now = new Date().toISOString();

  return {
    ...buildFailedResult(fundCode, message),
    lastFetchedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function parseStoredPayload(payloadJson: string | null, fundCode: string): FundQuarterlyResult {
  if (!payloadJson) {
    return buildFailedResult(fundCode, "尚未抓取季报。");
  }

  try {
    const parsed = JSON.parse(payloadJson) as Partial<FundQuarterlyResult>;

    if (!parsed || typeof parsed !== "object" || typeof parsed.fundCode !== "string") {
      return buildFailedResult(fundCode, "本地缓存格式无效。");
    }

    return {
      ...buildFailedResult(fundCode, "本地缓存格式无效。"),
      ...parsed,
      fundCode: parsed.fundCode || fundCode,
      latestQuarterlyReport: parsed.latestQuarterlyReport ?? null,
    };
  } catch {
    return buildFailedResult(fundCode, "本地缓存损坏，需重新抓取。");
  }
}

function toStoredFundQuarterlyResult(record: {
  fundCode: string;
  latestPayloadJson: string | null;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredFundQuarterlyResult {
  const parsed = parseStoredPayload(record.latestPayloadJson, record.fundCode);

  return {
    ...parsed,
    lastFetchedAt: record.lastFetchedAt ? record.lastFetchedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listStoredFundQuarterlies(kind: FundQuarterlyKind): Promise<StoredFundQuarterlyListPayload> {
  const rows = await prisma.fundQuarterlyTracking.findMany({
    where: {
      fundKind: kind,
      isActive: true,
    },
    orderBy: [{ lastFetchedAt: "desc" }, { updatedAt: "desc" }, { fundCode: "asc" }],
  });

  return {
    generatedAt: new Date().toISOString(),
    data: rows.map((row) => toStoredFundQuarterlyResult(row)),
  };
}

export async function saveTrackedFundQuarterly(kind: FundQuarterlyKind, fundCode: string) {
  const normalizedFundCode = normalizeFundCodeInput(fundCode);

  if (!isValidFundCode(normalizedFundCode)) {
    throw new Error("基金代码需为 6 位数字。");
  }

  // 这里的保存策略是“按代码覆盖最近一次结果”，而不是保留完整抓取历史。
  // 原因：当前页面关注的是低频跟踪和阅读，不是历史审计。
  const result = await fetchFundLatestQuarterly(normalizedFundCode);
  const now = new Date();
  const latestReportDate = result.latestQuarterlyReport?.publishDate
    ? new Date(`${result.latestQuarterlyReport.publishDate}T00:00:00Z`)
    : null;

  const record = await prisma.fundQuarterlyTracking.upsert({
    where: {
      fundKind_fundCode: {
        fundKind: kind,
        fundCode: result.fundCode,
      },
    },
    update: {
      isActive: true,
      latestPayloadJson: JSON.stringify(result),
      lastFetchedAt: now,
      latestReportDate,
    },
    create: {
      fundKind: kind,
      fundCode: result.fundCode,
      isActive: true,
      latestPayloadJson: JSON.stringify(result),
      lastFetchedAt: now,
      latestReportDate,
    },
  });

  return toStoredFundQuarterlyResult(record);
}

export async function getStoredFundQuarterly(kind: FundQuarterlyKind, fundCode: string) {
  const normalizedFundCode = normalizeFundCodeInput(fundCode);

  if (!isValidFundCode(normalizedFundCode)) {
    return createStoredFallbackResult(normalizedFundCode || fundCode, "基金代码需为 6 位数字。");
  }

  const record = await prisma.fundQuarterlyTracking.findUnique({
    where: {
      fundKind_fundCode: {
        fundKind: kind,
        fundCode: normalizedFundCode,
      },
    },
  });

  if (!record) {
    return createStoredFallbackResult(normalizedFundCode, "本地尚无该基金季报记录。");
  }

  return toStoredFundQuarterlyResult(record);
}
