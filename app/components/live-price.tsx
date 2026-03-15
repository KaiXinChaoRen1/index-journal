"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFxValue, formatIndexValue } from "@/lib/market-shared";
import {
  buildLivePriceMeta,
  getLivePricePollMs,
  type LivePricePayload,
} from "@/lib/live-price-shared";

type LivePriceProps = {
  symbol: string;
  mode: "index" | "fx";
};

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: LivePricePayload; error: null }
  | { status: "error"; data: null; error: string };

export function LivePrice({ symbol, mode }: LivePriceProps) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    // 重置为加载中只在 symbol 变化（或首次挂载）时做一次，
    // 轮询期间不重置，避免每 60 秒闪一次"加载中..."把已有数据清掉。
    setState({ status: "loading", data: null, error: null });

    async function load() {
      try {
        const response = await fetch(`/api/live-price?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data?: LivePricePayload;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? `Request failed: ${response.status}`);
        }

        if (!cancelled) {
          setState({ status: "success", data: payload.data, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            data: null,
            error: error instanceof Error ? error.message : "实时价格加载失败。",
          });
        }
      }
    }

    load();
    const timer = setInterval(load, getLivePricePollMs());

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol]);

  const formatValue = useMemo(
    () => (mode === "fx" ? formatFxValue : formatIndexValue),
    [mode],
  );

  if (state.status === "loading") {
    return (
      <div className="headline-metric">
        <p className="live-price-status">加载中...</p>
        <span>官方实时价格</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="headline-metric">
        <p className="live-price-status error">加载失败</p>
        <span className="live-price-meta">{state.error}</span>
      </div>
    );
  }

  return (
    <div className="headline-metric">
      <p>{formatValue(state.data.price)}</p>
      <span className="live-price-meta">{buildLivePriceMeta(state.data)}</span>
    </div>
  );
}
