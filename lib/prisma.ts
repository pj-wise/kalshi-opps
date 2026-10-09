import { PrismaClient } from "@prisma/client";

declare global {
  var __betggPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__betggPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__betggPrisma = prisma;
}
