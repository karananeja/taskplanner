#!/usr/bin/env node
/**
 * Recreate a throwaway SQLite database from the Prisma schema, optionally with demo data.
 * Used by the API integration tests and the end-to-end tests; never touches dev.db.
 *
 *   node scripts/reset-db.mjs <file.db> [--seed]
 *
 * TEST_SCHEMA_SQL=<file.sql> builds the schema from raw SQL instead of `prisma db push`, for
 * machines where Prisma's schema engine can't be downloaded (offline CI caches, sandboxes).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [file, ...flags] = process.argv.slice(2);
if (!file || !file.endsWith(".db") || /(^|\/)dev\.db$/.test(file)) {
  console.error("Usage: reset-db.mjs <throwaway.db> [--seed]  (refuses to touch dev.db)");
  process.exit(1);
}
const dbPath = path.resolve(apiDir, file);
for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });

const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
const sql = process.env.TEST_SCHEMA_SQL;
if (sql && existsSync(sql)) {
  const Database = createRequire(import.meta.url)("better-sqlite3");
  new Database(dbPath).exec(readFileSync(sql, "utf8"));
} else {
  execSync("npx prisma db push --accept-data-loss", { cwd: apiDir, env, stdio: "pipe" });
}
if (flags.includes("--seed")) {
  execSync("npx tsx prisma/seed.ts", { cwd: apiDir, env, stdio: "inherit" });
}
console.log(`Database ready: ${path.relative(process.cwd(), dbPath)}`);
