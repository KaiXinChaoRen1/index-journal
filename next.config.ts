import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 显式钉住项目根目录。
  // 背景：上层目录（用户主目录）残留了一个无关的 package-lock.json，Turbopack 推断
  // workspace root 时会误判到那里并打印警告。这里把根锁定在当前项目，消除根目录歧义。
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
