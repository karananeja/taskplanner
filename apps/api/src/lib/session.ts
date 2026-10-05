import type { Request, Response } from "express";
import { prisma } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "tp_session";
const DAY_MS = 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProd,
  path: "/",
});

export async function createSession(res: Response, userId: string, req: Request) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + env.SESSION_DAYS * DAY_MS);
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt, userAgent: req.get("user-agent")?.slice(0, 300) },
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") {
    await prisma.session.deleteMany({ where: { id: sha256(token) } });
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

/** Resolve the signed-in user from the session cookie, extending sessions that are past half-life. */
export async function readSession(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length < 20) return null;
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < (env.SESSION_DAYS * DAY_MS) / 2) {
    const expiresAt = new Date(Date.now() + env.SESSION_DAYS * DAY_MS);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
    req.res?.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
  }
  return session.user;
}
