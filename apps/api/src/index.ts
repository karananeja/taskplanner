import { createApp } from "./app";
import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./lib/logger";

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Clear out expired sessions once an hour.
const sweep = setInterval(() => {
  prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((err) => logger.warn({ err }, "session sweep failed"));
}, 60 * 60 * 1000);

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  clearInterval(sweep);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
