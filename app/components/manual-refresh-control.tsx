"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

// 这是“用户点击刷新 -> 调 API -> 刷新服务端页面”的前端入口组件。
function formatLocalTime(value: string | null) {
  if (!value) {
    return "暂无快照";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  // 必须固定 timeZone：这是客户端组件，且首屏由服务端注水。
  // 不指定时区会按各自运行环境的本地时区格式化，服务端与浏览器时区不同就会注水不一致。
  // 本产品以北京时间为口径，这里统一用 Asia/Shanghai，保证两端输出一致且符合阅读习惯。
  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
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

  const noteText =
    group === "market"
      ? "昨夜收盘到正式 EOD 完成前可参考手动快照；纽约交易时段首页头部允许显示实时价，区间统计继续使用日线历史口径。"
      : "当前价格使用最近快照；区间统计继续使用日线历史口径。";

  async function handleRefresh() {
    startTransition(async () => {
      try {
        // POST 成功后不手动拼页面状态，而是直接 router.refresh()，
        // 让服务端页面按既有链路重新取数，这样更容易维持口径一致。
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
      <p className="refresh-note">{noteText}</p>
    </section>
  );
}
