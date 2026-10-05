import type { NextFunction, Request, Response } from "express";
import { env } from "../env";
import { HttpError } from "../lib/errors";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated requests: session cookies are SameSite=Lax, and every
 * state-changing request must come from our own origin and carry a JSON body. Browsers can't send
 * cross-site JSON without a CORS preflight, which this API never grants.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && origin !== env.WEB_ORIGIN && !isLocalApiOrigin(origin, req)) {
    throw new HttpError(403, "bad_origin", "This request came from an unexpected site.");
  }
  const hasBody = Number(req.get("content-length") ?? 0) > 0 || req.get("transfer-encoding");
  if (hasBody && !req.is("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Send requests as JSON.");
  }
  next();
}

function isLocalApiOrigin(origin: string, req: Request) {
  return origin === `${req.protocol}://${req.get("host")}`;
}
