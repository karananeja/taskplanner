/**
 * Demo data: one workspace with four people and a handful of tasks.
 * Everyone's password is "password123". Safe to re-run; it skips if the demo workspace exists.
 */
import { positionBetween } from "@tp/shared";
import { prisma } from "../src/db";
import { hashPassword } from "../src/lib/crypto";

async function main() {
  if (await prisma.workspace.findUnique({ where: { inviteCode: "demoinvitecode2026" } })) {
    console.log("Demo data already present, skipping.");
    return;
  }
  const passwordHash = await hashPassword("password123");
  const people = [
    { name: "Karan Aneja", email: "karan@example.com" },
    { name: "Jay Shrivastava", email: "jay@example.com" },
    { name: "Chirag Kumar", email: "chirag@example.com" },
    { name: "Joseph MJ", email: "joseph@example.com" },
  ];
  const users = [];
  for (const p of people) {
    users.push(await prisma.user.upsert({ where: { email: p.email }, update: {}, create: { ...p, passwordHash } }));
  }
  const [karan, jay, chirag, joseph] = users as [(typeof users)[0], (typeof users)[0], (typeof users)[0], (typeof users)[0]];

  const ws = await prisma.workspace.create({
    data: {
      name: "Software",
      inviteCode: "demoinvitecode2026",
      memberships: {
        create: [
          { userId: karan.id, role: "OWNER" },
          { userId: jay.id, role: "MEMBER" },
          { userId: chirag.id, role: "MEMBER" },
          { userId: joseph.id, role: "MEMBER" },
        ],
      },
      labels: { create: [{ name: "Bug", color: "#dc2626" }, { name: "Feature", color: "#4f46e5" }] },
      clients: { create: [{ name: "Aryan", color: "#4f46e5" }, { name: "Northwind", color: "#ea580c" }] },
    },
    include: { labels: true, clients: true },
  });

  const today = new Date();
  const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  const positions: Record<string, string | null> = {};
  const next = (status: string) => (positions[status] = positionBetween(positions[status] ?? null, null));

  const tasks = [
    { title: "Draft onboarding checklist", status: "BACKLOG", priority: "LOW", by: karan, assignees: [] },
    { title: "Follow up with design on mockups", status: "TODO", priority: "MEDIUM", by: joseph, assignees: [jay], due: day(3) },
    { title: "Send contract to legal", status: "TODO", priority: "HIGH", by: karan, assignees: [chirag], due: day(-2), client: 0 },
    { title: "Fix login redirect loop", status: "IN_PROGRESS", priority: "HIGH", by: joseph, assignees: [joseph], due: day(1), label: 0 },
    { title: "Validate CSV export", status: "TESTING", priority: "NONE", by: jay, assignees: [jay, chirag], label: 1 },
    { title: "Ship invoice PDF template", status: "DONE", priority: "MEDIUM", by: karan, assignees: [karan], client: 1 },
    { title: "Old reporting dashboard", status: "CANCELED", priority: "NONE", by: joseph, assignees: [] },
  ] as const;

  for (const t of tasks) {
    const task = await prisma.task.create({
      data: {
        workspaceId: ws.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        position: next(t.status),
        startDate: day(-3),
        endDate: day(4),
        dueDate: "due" in t ? t.due : null,
        clientId: "client" in t ? ws.clients[t.client]!.id : null,
        createdById: t.by.id,
        owners: { create: [{ userId: t.by.id }] },
        assignees: { create: t.assignees.map((u) => ({ userId: u.id })) },
        labels: "label" in t ? { create: [{ labelId: ws.labels[t.label]!.id }] } : undefined,
        activities: { create: [{ actorId: t.by.id, type: "created" }] },
      },
    });
    if (t.status === "IN_PROGRESS") {
      await prisma.task.create({
        data: {
          workspaceId: ws.id,
          parentId: task.id,
          title: "Write a regression test for the redirect",
          status: "TODO",
          priority: "LOW",
          position: next("TODO"),
          createdById: joseph.id,
          owners: { create: [{ userId: joseph.id }] },
          activities: { create: [{ actorId: joseph.id, type: "created" }] },
        },
      });
      await prisma.checklistItem.createMany({
        data: [
          { taskId: task.id, text: "Reproduce locally", done: true, position: 1 },
          { taskId: task.id, text: "Patch session handling", done: false, position: 2 },
        ],
      });
    }
  }
  console.log("Seeded demo workspace. Sign in as karan@example.com / password123 (workspace owner).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
