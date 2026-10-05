import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "./env";

const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL.replace(/^file:/, "") });

export const prisma = new PrismaClient({ adapter });

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
