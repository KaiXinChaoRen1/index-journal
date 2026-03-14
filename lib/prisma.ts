import { PrismaClient } from "@prisma/client";

// Next.js 开发模式会重复加载模块。把 PrismaClient 挂到全局对象上，
// 可以避免本地热更新时不断创建新连接实例。
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
