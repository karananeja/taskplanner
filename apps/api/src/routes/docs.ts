import {
  type DocDetail,
  type DocSummary,
  LIMITS,
  createDocSchema,
  updateDocSchema,
  uploadDocSchema,
} from "@tp/shared";
import { Router } from "express";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { parse } from "../lib/validate";
import { wsCtx } from "../middleware/auth";
import { userSummary } from "../services/serialize";

/** Written docs and uploaded files. Mounted under /workspaces/:workspaceId/docs. */
export const docsRouter = Router({ mergeParams: true });

// Never load file bytes unless someone is downloading them.
const summarySelect = {
  id: true,
  title: true,
  clientId: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  createdBy: true,
} satisfies Prisma.DocSelect;
type SummaryRow = Prisma.DocGetPayload<{ select: typeof summarySelect }>;

const toSummary = (d: SummaryRow): DocSummary => ({
  id: d.id,
  title: d.title,
  clientId: d.clientId,
  kind: d.fileName ? "file" : "doc",
  fileName: d.fileName,
  fileType: d.fileType,
  fileSize: d.fileSize,
  createdBy: userSummary(d.createdBy),
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

async function checkClient(workspaceId: string, clientId: string | null | undefined) {
  if (!clientId) return;
  const client = await prisma.client.findFirst({ where: { id: clientId, workspaceId } });
  if (!client) throw badRequest("That client isn't in this workspace.", { clientId: "Unknown client" });
}

async function findDoc(workspaceId: string, docId: string) {
  const doc = await prisma.doc.findFirst({ where: { id: docId, workspaceId }, select: { ...summarySelect, body: true } });
  if (!doc) throw notFound("Doc");
  return doc;
}

const docIdOf = (params: Record<string, unknown>) => String(params.docId);

docsRouter.get("/", async (req, res) => {
  const { workspace } = wsCtx(req);
  const docs = await prisma.doc.findMany({ where: { workspaceId: workspace.id }, select: summarySelect, orderBy: { updatedAt: "desc" } });
  res.json(docs.map(toSummary));
});

docsRouter.post("/", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const input = parse(createDocSchema, req.body);
  await checkClient(workspace.id, input.clientId);
  const doc = await prisma.doc.create({
    data: { workspaceId: workspace.id, title: input.title, body: input.body ?? "", clientId: input.clientId ?? null, createdById: user.id },
    select: { ...summarySelect, body: true },
  });
  res.status(201).json({ ...toSummary(doc), body: doc.body } satisfies DocDetail);
});

docsRouter.post("/upload", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const input = parse(uploadDocSchema, req.body);
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (bytes.length === 0) throw badRequest("The file is empty.");
  if (bytes.length > LIMITS.uploadBytes) throw badRequest("Files can be at most 5 MB.");
  await checkClient(workspace.id, input.clientId);
  const doc = await prisma.doc.create({
    data: {
      workspaceId: workspace.id,
      title: input.fileName,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: bytes.length,
      fileData: bytes,
      clientId: input.clientId ?? null,
      createdById: user.id,
    },
    select: summarySelect,
  });
  res.status(201).json(toSummary(doc));
});

docsRouter.get("/:docId", async (req, res) => {
  const { workspace } = wsCtx(req);
  const doc = await findDoc(workspace.id, docIdOf(req.params));
  res.json({ ...toSummary(doc), body: doc.body } satisfies DocDetail);
});

docsRouter.get("/:docId/file", async (req, res) => {
  const { workspace } = wsCtx(req);
  const doc = await prisma.doc.findFirst({ where: { id: docIdOf(req.params), workspaceId: workspace.id } });
  if (!doc?.fileData) throw notFound("File");
  // Always a download, never rendered inline, so an uploaded HTML or SVG file can't run in our origin.
  res.attachment(doc.fileName ?? "download");
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(Buffer.from(doc.fileData));
});

docsRouter.patch("/:docId", async (req, res) => {
  const { workspace } = wsCtx(req);
  const changes = parse(updateDocSchema, req.body);
  const doc = await findDoc(workspace.id, docIdOf(req.params));
  if (doc.fileName && changes.body !== undefined) throw badRequest("Uploaded files can't be edited here.");
  await checkClient(workspace.id, changes.clientId);
  const updated = await prisma.doc.update({ where: { id: doc.id }, data: changes, select: { ...summarySelect, body: true } });
  res.json({ ...toSummary(updated), body: updated.body } satisfies DocDetail);
});

docsRouter.delete("/:docId", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const doc = await findDoc(workspace.id, docIdOf(req.params));
  if (doc.createdById !== user.id && workspace.role !== "OWNER") {
    throw forbidden("Only the person who added this doc, or the workspace owner, can delete it.");
  }
  await prisma.doc.delete({ where: { id: doc.id } });
  res.status(204).end();
});
