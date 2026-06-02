import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Index Journal | 指数日志",
  description:
    "Index Journal 是一个聚焦美股核心指数的盘后市场观察面板，提供 SPY / QQQ 的阶段表现、长期指标与走势图。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning 仅用于压制浏览器扩展/代理向 <html>/<body> 根节点注入属性
  // （如 data-*、class）导致的 hydration 属性告警——这类差异来自客户端环境，不是我们的渲染问题。
  // 注意边界：它只压制这两个根节点自身的属性差异，不会向下传播；如果未来子树出现真实的
  // 服务端/客户端不一致，仍会正常告警，不要把这里当成常规写法到处套用。
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
