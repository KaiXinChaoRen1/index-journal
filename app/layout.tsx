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
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
