import { formatPercentOrFallback } from "@/lib/market-shared";

function getTone(value: number) {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}

function getNullableTone(value: number | null) {
  return value === null ? "neutral" : getTone(value);
}

export function MetricRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong className={getNullableTone(value)}>{formatPercentOrFallback(value)}</strong>
    </div>
  );
}
