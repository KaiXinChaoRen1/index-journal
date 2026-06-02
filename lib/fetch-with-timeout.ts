/**
 * 带超时的 fetch。
 *
 * 为什么需要它：项目多处要请求外部数据源（证监会披露平台、指数点位、行情）。原生 fetch
 * 默认没有超时，任一外部源卡住，调用方——无论是首页 SSR 还是用户的 POST 请求——就会
 * 一直挂到运行时超时。这里统一给外部请求设上限，并把"超时"这一原因明确写进错误信息，
 * 让卡住能被快速定位，而不是表现成一次莫名其妙的长时间无响应。
 *
 * 用法上要求每个调用点显式传入 timeoutMs 和 label：超时上限是和具体数据源强相关的判断，
 * 不应该有一个"默认值"替调用方猜；label 用于在超时报错里指明是哪一步卡住。
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: { timeoutMs: number; label: string },
): Promise<Response> {
  const { timeoutMs, label } = options;

  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    // AbortSignal.timeout 到点会抛出 name 为 "TimeoutError" 的 DOMException。
    // 这里把它转成可读、可定位的错误，区别于其它网络错误。
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(`${label}请求超时（超过 ${Math.round(timeoutMs / 1000)} 秒未响应）。`);
    }

    throw error;
  }
}
