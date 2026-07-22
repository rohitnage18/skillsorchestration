import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};
let localPrisma = globalForPrisma.prisma;
let localPool = globalForPrisma.pool;

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDbClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

function getDbClient() {
  if (localPrisma) {
    return localPrisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when a database operation is attempted.");
  }

  const schema = getSchemaFromConnectionString(connectionString);
  const pool =
    localPool ??
    new Pool({
      connectionString,
      ...(schema ? { options: `-c search_path=${schema}` } : {}),
    });
  const adapter = new PrismaPg(pool, schema ? { schema } : undefined);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  localPrisma = client;
  localPool = pool;

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.pool = pool;
  }

  return client;
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
