import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger";
import { requireUser } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { csrfGuard } from "./middleware/security";
import { authRouter } from "./routes/auth";
import { googleRouter } from "./routes/google";
import { workspacesRouter } from "./routes/workspaces";

const DOCS_PATH = /^\/api\/workspaces\/[^/]+\/docs(\/|$)/;

export function createApp() {
  const app = express();
  app.set("trust proxy", "loopback");
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  // Docs carry long bodies and base64 uploads (5 MB of file is about 6.7 MB of base64).
  const smallJson = express.json({ limit: "200kb" });
  const docsJson = express.json({ limit: "8mb" });
  app.use((req, res, next) => (DOCS_PATH.test(req.path) ? docsJson : smallJson)(req, res, next));
  app.use(cookieParser());
  app.use("/api", csrfGuard);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth/google", googleRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/workspaces", requireUser, workspacesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
