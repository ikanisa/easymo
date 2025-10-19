import { PrismaClient } from "@prisma/client";

export class PrismaService extends PrismaClient {
  constructor() {
    super({
      log: process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "info", "warn", "error"],
    });
  }
}
