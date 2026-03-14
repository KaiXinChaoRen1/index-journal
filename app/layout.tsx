import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Index Journal | 指数日志",
  description:
    "Index Journal 是一个围绕指数投资、AI 协作开发与个人学习过程展开的长期个人项目。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
