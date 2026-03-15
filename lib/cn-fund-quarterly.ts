import { CN_FUND_CODES, type CnFundCode } from "@/lib/cn-fund-config";
import mammoth from "mammoth";

const CSRC_VALIDATE_URL = "http://eid.csrc.gov.cn/fund/disclose/validate_fund.do";
const CSRC_FUND_DETAIL_URL = "http://eid.csrc.gov.cn/fund/disclose/fund_detail.do";
const CSRC_ORIGIN = "http://eid.csrc.gov.cn";
const BATCH_CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

type QuarterlyReportItem = {
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
};

export type CnFundQuarterlyResult = {
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

type FundIdLookupResult =
  | {
      ok: true;
      fundId: string;
    }
  | {
      ok: false;
      message: string;
    };

type QuarterlyBatchPayload = {
  generatedAt: string;
  fromCache: boolean;
  data: CnFundQuarterlyResult[];
};

type BatchCacheEntry = {
  expiresAt: number;
  generatedAt: string;
  data: CnFundQuarterlyResult[];
};

const batchCache = new Map<string, BatchCacheEntry>();

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
      /<a[^>]*href="([^"]*instance_show_pdf_id\.do\?instanceid=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/i,
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

function extractNetValuePerformanceText(text: string) {
  if (!text) {
    return {
      text: null,
      table: null,
    };
  }

  const startCandidates = [
    "3.2.1本报告期基金份额净值增长率及其与同期业绩比较基准收益率的比较",
    "3.2.1 基金份额净值增长率及其与同期业绩比较基准收益率的比较",
    "3.2.1本报告期基金份额净值增长率及其与同期业绩比较基准收益率比较",
    "净值增长率及其与同期业绩比较基准收益率的比较",
  ];

  let start = -1;
  for (const key of startCandidates) {
    start = text.indexOf(key);
    if (start >= 0) {
      break;
    }
  }

  if (start < 0) {
    return {
      text: null,
      table: null,
    };
  }

  let end = text.indexOf("3.2.2", start);
  if (end < 0) {
    end = text.indexOf("3.3", start);
  }
  if (end < 0) {
    end = text.indexOf("§4", start);
  }
  if (end < 0) {
    end = Math.min(text.length, start + 2200);
  }

  const section = normalizeDocumentText(text.slice(start, end));
  if (!section) {
    return {
      text: null,
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

  let formatted = section;
  for (const marker of lineBreakMarkers) {
    formatted = formatted.replace(new RegExp(escapeRegex(marker), "g"), `\n${marker}`);
  }
  formatted = formatted
    .replace(/3\.2\.1/g, "\n3.2.1")
    .replace(/\n+/g, "\n")
    .trim();

  const outputText = formatted.slice(0, 2600);
  const compact = outputText.replace(/\s+/g, "");
  const columns = ["净值增长率①", "净值增长率标准差②", "业绩比较基准收益率③", "业绩比较基准收益率标准差④", "①-③", "②-④"];
  const rowDefs: Array<{ label: string; pattern: string }> = [
    { label: "过去三个月", pattern: "(?:过去三个月|过去三月)" },
    { label: "过去六个月", pattern: "(?:过去六个月|过去六月)" },
    { label: "过去一年", pattern: "过去一年" },
    { label: "过去三年", pattern: "过去三年" },
    { label: "过去五年", pattern: "过去五年" },
    { label: "自基金合同生效起至今", pattern: "自基金合同生效起至今" },
  ];
  const rowStarts = rowDefs
    .map((row) => {
      const match = compact.match(new RegExp(row.pattern));
      return {
        ...row,
        start: match ? match.index ?? -1 : -1,
        hit: match ? match[0] : null,
      };
    })
    .filter((row) => row.start >= 0)
    .sort((a, b) => a.start - b.start);
  const tokenPattern = /[-+]?\d+(?:\.\d+)?%|-/g;
  const parsedRows: Array<{ stage: string; values: string[] }> = [];

  for (let index = 0; index < rowStarts.length; index += 1) {
    const current = rowStarts[index];
    const next = rowStarts[index + 1];
    const segment = compact.slice(current.start, next ? next.start : compact.length);
    const segmentWithoutLabel = current.hit ? segment.slice(current.hit.length) : segment;
    const tokens = segmentWithoutLabel.match(tokenPattern) ?? [];
    const values = tokens.slice(0, 6);

    if (values.length > 0) {
      while (values.length < 6) {
        values.push("-");
      }
      parsedRows.push({
        stage: current.label,
        values,
      });
    }
  }

  return {
    text: outputText,
    table:
      parsedRows.length > 0
        ? {
            columns,
            rows: parsedRows,
          }
        : null,
  };
}

async function enrichLatestQuarterlyReportWithNetValue(item: QuarterlyReportItem) {
  const parsed = await parseReportText(item.detailUrl);

  if (!parsed.text) {
    return {
      ...item,
      netValuePerformance: null,
      netValuePerformanceTable: null,
      netValuePerformanceStatus: parsed.message,
    };
  }

  const netValuePerformance = extractNetValuePerformanceText(parsed.text);

  if (!netValuePerformance.text) {
    return {
      ...item,
      netValuePerformance: null,
      netValuePerformanceTable: null,
      netValuePerformanceStatus: "已解析季报正文，但未定位到基金净值表现段落。",
    };
  }

  return {
    ...item,
    netValuePerformance: netValuePerformance.text,
    netValuePerformanceTable: netValuePerformance.table,
    netValuePerformanceStatus: parsed.message,
  };
}

export async function getFundIdByCode(fundCode: string): Promise<FundIdLookupResult> {
  try {
    // 关键口径：真实基金代码不能直接当详情页参数，必须先通过校验接口换取内部 fundId。
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

    if (!response.ok || isLikelyBlockedPage(await response.clone().text())) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchCnFundLatestQuarterly(fundCode: string): Promise<CnFundQuarterlyResult> {
  const fundIdResult = await getFundIdByCode(fundCode);

  if (!fundIdResult.ok) {
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
      message: fundIdResult.message,
      latestQuarterlyReport: null,
    };
  }

  const fundId = fundIdResult.fundId;
  const html = await fetchFundDetailById(fundId);

  if (!html) {
    return {
      fundCode,
      fundId,
      fundName: null,
      fundOperationMode: null,
      fundCategory: null,
      fundManager: null,
      fundCustodian: null,
      fundContractEffectiveDate: null,
      status: "failed",
      message: "未获取到有效详情页。",
      latestQuarterlyReport: null,
    };
  }

  if (!html.includes("资本市场统一信息披露平台")) {
    return {
      fundCode,
      fundId,
      fundName: null,
      fundOperationMode: null,
      fundCategory: null,
      fundManager: null,
      fundCustodian: null,
      fundContractEffectiveDate: null,
      status: "failed",
      message: "详情页内容无效。",
      latestQuarterlyReport: null,
    };
  }

  const overview = extractFundOverview(html, fundCode);
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

export async function fetchPresetCnFundQuarterlyBatch(
  codes: readonly string[] = CN_FUND_CODES,
  options: { forceRefresh?: boolean } = {},
): Promise<QuarterlyBatchPayload> {
  const cacheKey = [...codes].join("|");
  const current = batchCache.get(cacheKey);
  const now = Date.now();

  if (!options.forceRefresh && current && current.expiresAt > now) {
    return {
      generatedAt: current.generatedAt,
      fromCache: true,
      data: current.data,
    };
  }

  const data = await Promise.all(codes.map((code) => fetchCnFundLatestQuarterly(code)));
  const generatedAt = new Date().toISOString();

  batchCache.set(cacheKey, {
    generatedAt,
    data,
    expiresAt: now + BATCH_CACHE_TTL_MS,
  });

  return {
    generatedAt,
    fromCache: false,
    data,
  };
}

export function getPresetCnFundCodes() {
  return [...CN_FUND_CODES] as CnFundCode[];
}
