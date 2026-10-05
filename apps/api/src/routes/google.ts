import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { randomToken } from "../lib/crypto";
import { logger } from "../lib/logger";
import { createSession } from "../lib/session";

/**
 * Google sign-in with the OAuth 2.0 authorization-code flow. The redirect URI goes through the web
 * app's /api proxy so the session cookie is set on the same origin as the app.
 */
export const googleRouter = Router();

const STATE_COOKIE = "tp_oauth_state";
const redirectUri = () => `${env.WEB_ORIGIN}/api/auth/google/callback`;
const back = (error?: string) => `${env.WEB_ORIGIN}/login${error ? `?error=${encodeURIComponent(error)}` : ""}`;

const tokenSchema = z.object({ access_token: z.string() });
const profileSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

googleRouter.get("/", (_req, res) => {
  if (!env.googleEnabled) return res.redirect(back("Google sign-in isn't set up on this server."));
  const state = randomToken(24);
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: env.isProd, maxAge: 10 * 60 * 1000, path: "/" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  res.redirect(url.toString());
});

googleRouter.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const expected = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/" });
  if (typeof code !== "string" || typeof state !== "string" || !expected || state !== expected) {
    return res.redirect(back("Google sign-in expired. Try again."));
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const { access_token } = tokenSchema.parse(await tokenRes.json());
    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) throw new Error(`userinfo failed: ${profileRes.status}`);
    const profile = profileSchema.parse(await profileRes.json());
    if (!profile.email_verified) return res.redirect(back("Your Google email isn't verified."));

    const email = profile.email.toLowerCase();
    const byGoogle = await prisma.user.findUnique({ where: { googleId: profile.sub } });
    const user =
      byGoogle ??
      (await prisma.user.upsert({
        // Link to an existing email account: Google has verified the address.
        where: { email },
        update: { googleId: profile.sub, avatarUrl: profile.picture },
        create: { email, name: profile.name ?? email.split("@")[0]!, googleId: profile.sub, avatarUrl: profile.picture },
      }));
    await createSession(res, user.id, req);
    res.redirect(env.WEB_ORIGIN);
  } catch (err) {
    logger.error({ err }, "Google sign-in failed");
    res.redirect(back("Google sign-in failed. Try again."));
  }
});
