"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CHART_RANGES,
  formatDate,
  formatFxValue,
  formatIndexValue,
  getDefaultChartRange,
  type ChartRange,
  type MarketChartData,
} from "@/lib/market-shared";

type MarketChartProps = {
  symbol: string;
  title: string;
  initialData: MarketChartData;
  apiPath?: string;
  valueType?: "index" | "fx";
  copyText?: string;
};

const CHART_LINE_COLOR = "#2f6840";
const CHART_GUIDE_COLOR = "rgba(58, 46, 32, 0.12)";
const CHART_DOT_STROKE = "#fffaf2";

// 图表只负责提供趋势感，不承担“精确读数”的任务，
// 所以这里保持最基础的折线映射，不引入额外的金融图表复杂度。
function getPointCoordinates(
  points: MarketChartData["points"],
  width: number,
  height: number,
) {
  if (points.length === 0) {
    return [];
  }

  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ySpan = max - min || 1;

  return points.map((point, index) => ({
    x: points.length === 1 ? width : (index / (points.length - 1)) * width,
    y: height - ((point.close - min) / ySpan) * height,
  }));
}

export function MarketChart({
  symbol,
  title,
  initialData,
  apiPath = "/api/market/chart",
  valueType = "index",
  copyText = `${title} 的趋势图只负责帮助快速看方向，详细解读仍以下方指标为主。`,
}: MarketChartProps) {
  const [range, setRange] = useState<ChartRange>(getDefaultChartRange());
  const [chartData, setChartData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // 首页首屏已经把默认区间的数据 SSR 下来了，这里只在 symbol 切换
    // 或服务端重新提供了默认数据时同步一次，避免首屏重复请求。
    setChartData(initialData);
    setRange(initialData.range);
  }, [initialData]);

  function handleRangeChange(nextRange: ChartRange) {
    if (nextRange === range || isPending) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(`${apiPath}?symbol=${encodeURIComponent(symbol)}&range=${nextRange}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as { data: MarketChartData };
        setRange(nextRange);
        setChartData(payload.data);
      } catch {
        setError("走势图暂时加载失败，请稍后再试。");
      }
    });
  }

  const width = 720;
  const height = 180;
  const values = chartData.points.map((point) => point.close);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const coordinates = getPointCoordinates(chartData.points, width, height);
  const safeCoordinates = coordinates.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  const polylinePoints = safeCoordinates
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const latestCoordinate = safeCoordinates.at(-1) ?? null;
  const latestPoint = chartData.points.at(-1) ?? null;
  const firstPoint = chartData.points.at(0) ?? null;
  const valueFormatter = valueType === "fx" ? formatFxValue : formatIndexValue;

  return (
    <section className="chart-panel">
      <div className="chart-head">
        <div>
          <p className="metric-group-title">走势</p>
          <p className="chart-copy">{copyText}</p>
        </div>
        <div className="range-switcher" role="tablist" aria-label={`${title} 图表范围`}>
          {CHART_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={item === range ? "range-chip active" : "range-chip"}
              onClick={() => handleRangeChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="chart-empty">{error}</div>
      ) : chartData.points.length < 2 || safeCoordinates.length < 2 ? (
        <div className="chart-empty">当前范围内数据不足，暂时无法绘制趋势图。</div>
      ) : (
        <>
          <div className={isPending ? "chart-canvas loading" : "chart-canvas"}>
            <div className="chart-axis">
              <div className="chart-axis-item">
                <span className="chart-axis-label">区间高点</span>
                <strong>{valueFormatter(max)}</strong>
              </div>
              <div className="chart-axis-item">
                <span className="chart-axis-label">区间低点</span>
                <strong>{valueFormatter(min)}</strong>
              </div>
            </div>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              aria-label={`${title} ${range} 折线图`}
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="0"
                x2={width}
                y2="0"
                className="chart-guide"
                stroke={CHART_GUIDE_COLOR}
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              <line
                x1="0"
                y1={height}
                x2={width}
                y2={height}
                className="chart-guide"
                stroke={CHART_GUIDE_COLOR}
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              <polyline
                points={polylinePoints}
                className="chart-line"
                fill="none"
                stroke={CHART_LINE_COLOR}
                strokeWidth="2.6"
                strokeOpacity="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                shapeRendering="geometricPrecision"
              />
              {latestCoordinate ? (
                <circle
                  cx={latestCoordinate.x}
                  cy={latestCoordinate.y}
                  r="4.5"
                  className="chart-dot"
                  fill={CHART_LINE_COLOR}
                  stroke={CHART_DOT_STROKE}
                  strokeWidth="2"
                />
              ) : null}
            </svg>
          </div>

          <div className="chart-meta">
            <span>
              起点 {firstPoint ? formatDate(new Date(`${firstPoint.date}T00:00:00Z`)) : "数据不足"} /{" "}
              {firstPoint ? valueFormatter(firstPoint.close) : "数据不足"}
            </span>
            <span>
              终点 {latestPoint ? formatDate(new Date(`${latestPoint.date}T00:00:00Z`)) : "数据不足"} /{" "}
              {latestPoint ? valueFormatter(latestPoint.close) : "数据不足"}
            </span>
            {chartData.isSampled ? <span>MAX 范围已做轻量抽样，便于页面稳定展示。</span> : null}
          </div>
        </>
      )}
    </section>
  );
}
