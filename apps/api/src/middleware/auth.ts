import type { NextFunction, Request, Response } from "express";
import type { WorkspaceRole } from "@tp/shared";
import type { User } from "../generated/prisma/client";
import { prisma } from "../db";
import { forbidden, notFound, unauthorized } from "../lib/errors";
import { readSession } from "../lib/session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      workspace?: { id: string; role: WorkspaceRole };
    }
  }
}

export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  const user = await readSession(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

/** For routes under /workspaces/:workspaceId — the caller must be a member. */
export async function requireMembership(req: Request, _res: Response, next: NextFunction) {
  const workspaceId = typeof req.params.workspaceId === "string" ? req.params.workspaceId : undefined;
  if (!req.user) throw unauthorized();
  if (!workspaceId) throw notFound("Workspace");
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId } },
  });
  // Same response whether the workspace doesn't exist or you aren't in it, so ids can't be probed.
  if (!membership) throw notFound("Workspace");
  req.workspace = { id: workspaceId, role: membership.role as WorkspaceRole };
  next();
}

export function requireWorkspaceOwner(req: Request, _res: Response, next: NextFunction) {
  if (req.workspace?.role !== "OWNER") throw forbidden("Only the workspace owner can do this.");
  next();
}

/** Narrowing helpers for handlers that run after the middleware above. */
export function ctx(req: Request) {
  if (!req.user) throw unauthorized();
  return { user: req.user };
}
export function wsCtx(req: Request) {
  if (!req.user || !req.workspace) throw unauthorized();
  return { user: req.user, workspace: req.workspace };
}
