"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

function formatLocalTime(value: string | null) {
  if (!value) {
    return "暂无快照";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

type ManualRefreshControlProps = {
  group: "market" | "forex" | "btc";
  title: string;
  initialLastSuccessAt: string | null;
  initialLastErrorMessage?: string | null;
  initialCanRefresh: boolean;
  initialAvailabilityReason?: string | null;
};

type RefreshApiResponse = {
  ok: boolean;
  status: "updated" | "cooldown" | "error" | "blocked";
  message: string;
  cooldownRemainingSeconds: number;
  availability: {
    canRefresh: boolean;
    reason: string | null;
  };
  state: {
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
    lastErrorMessage: string | null;
  };
};

export function ManualRefreshControl({
  group,
  title,
  initialLastSuccessAt,
  initialLastErrorMessage = null,
  initialCanRefresh,
  initialAvailabilityReason = null,
}: ManualRefreshControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(initialLastSuccessAt);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    initialLastErrorMessage ?? initialAvailabilityReason,
  );
  const [canRefresh, setCanRefresh] = useState(initialCanRefresh);

  const metaText = useMemo(() => {
    if (!lastSuccessAt) {
      return "尚未获取手动快照";
    }

    return `最近快照：${formatLocalTime(lastSuccessAt)}`;
  }, [lastSuccessAt]);

  async function handleRefresh() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/manual-snapshot/${group}`, {
          method: "POST",
          headers: { accept: "application/json" },
        });
        const payload = (await response.json()) as RefreshApiResponse;
        setStatusMessage(payload.message);
        setLastSuccessAt(payload.state.lastSuccessAt);
        setCanRefresh(payload.availability.canRefresh);
        router.refresh();
      } catch {
        setStatusMessage("刷新失败，当前仍显示最近一次快照或历史数据。");
      }
    });
  }

  return (
    <section className="refresh-panel">
      <div className="refresh-panel-head">
        <p className="metric-group-title">{title}</p>
        <button
          type="button"
          className={isPending ? "refresh-button pending" : "refresh-button"}
          onClick={handleRefresh}
          disabled={isPending || !canRefresh}
        >
          {isPending ? "刷新中..." : canRefresh ? "刷新最新数据" : "当前时段不可刷新"}
        </button>
      </div>
      <p className="refresh-meta">{metaText}</p>
      {statusMessage ? <p className="refresh-status">{statusMessage}</p> : null}
      <p className="refresh-note">当前价格使用最近快照；区间统计继续使用日线历史口径。</p>
    </section>
  );
}
