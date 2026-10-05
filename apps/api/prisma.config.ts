import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Same default as src/env.ts, so `npm install` (which runs `prisma generate`) works before
  // apps/api/.env exists. Generating the client doesn't connect to the database anyway.
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
