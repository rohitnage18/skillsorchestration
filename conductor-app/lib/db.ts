import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const schema = getSchemaFromConnectionString(connectionString);

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });

const adapter = new PrismaPg(pool, schema ? { schema } : undefined);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pool = pool;
}

function getSchemaFromConnectionString(value: string) {
  try {
    const url = new URL(value);
    const schema = url.searchParams.get("schema");
    return schema && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : "";
  } catch {
    return "";
  }
}
