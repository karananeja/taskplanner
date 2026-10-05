import { type AuthConfig, type Me, loginSchema, signupSchema } from "@tp/shared";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { env } from "../env";
import { verifyPassword, hashPassword, randomToken } from "../lib/crypto";
import { HttpError, unauthorized } from "../lib/errors";
import { createSession, destroySession } from "../lib/session";
import { parse } from "../lib/validate";
import { ctx, requireUser } from "../middleware/auth";
import { userSummary } from "../services/serialize";
import type { WorkspaceRole } from "@tp/shared";

export const authRouter = Router();

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: { code: "rate_limited", message: "Too many attempts. Wait 15 minutes and try again." } }),
});

// A real hash to compare against when the email doesn't exist, so response time doesn't reveal accounts.
const dummyHash = hashPassword(randomToken());

export async function loadMe(userId: string): Promise<Me> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" } } },
  });
  return {
    user: userSummary(user),
    workspaces: user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role as WorkspaceRole,
    })),
  };
}

authRouter.get("/config", (_req, res) => {
  const config: AuthConfig = { google: env.googleEnabled };
  res.json(config);
});

authRouter.post("/signup", credentialLimiter, async (req, res) => {
  const input = parse(signupSchema, req.body);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "email_taken", "An account with this email already exists. Sign in instead.", {
      email: "Already registered",
    });
  }
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
  });
  await createSession(res, user.id, req);
  res.status(201).json(await loadMe(user.id));
});

authRouter.post("/login", credentialLimiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !user.passwordHash || !ok) {
    if (user && !user.passwordHash) {
      throw unauthorized("This account uses Google sign-in. Use “Continue with Google”.");
    }
    throw unauthorized("That email and password don't match.");
  }
  await createSession(res, user.id, req);
  res.json(await loadMe(user.id));
});

authRouter.post("/logout", async (req, res) => {
  await destroySession(req, res);
  res.status(204).end();
});

authRouter.get("/me", requireUser, async (req, res) => {
  res.json(await loadMe(ctx(req).user.id));
});
