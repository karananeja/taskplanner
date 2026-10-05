import pino from "pino";
import { env } from "../env";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  transport: env.isProd ? undefined : { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } },
  redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
});
