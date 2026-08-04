import { spawnSync } from "node:child_process";
import pg from "pg";

const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("E2E_DATABASE_URL is required. Point it at a disposable test database.");
}

const parsedUrl = new URL(databaseUrl);
if (!/(^|[_-])(e2e|test)([_-]|$)/i.test(parsedUrl.pathname.slice(1))) {
  throw new Error("E2E_DATABASE_URL database name must contain 'e2e' or 'test'.");
}

const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const migration = spawnSync(prismaCommand, ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  encoding: "utf-8",
  stdio: "inherit",
});
if (migration.status !== 0) {
  throw new Error(`Unable to prepare the E2E database (exit ${migration.status}).`);
}

const schema = parsedUrl.searchParams.get("schema") || "public";
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  throw new Error("E2E database schema name is invalid.");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const result = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename <> '_prisma_migrations'`,
    [schema]
  );
  if (result.rows.length > 0) {
    const quotedSchema = `"${schema}"`;
    const tables = result.rows.map(({ tablename }) => `${quotedSchema}."${tablename.replaceAll('"', '""')}"`);
    await client.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  }
} finally {
  await client.end();
}

console.log("E2E database migrated and reset.");
