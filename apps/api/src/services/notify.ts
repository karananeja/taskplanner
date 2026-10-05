import type { NotificationPrefs, NotificationType } from "@tp/shared";
import type { Tx } from "../db";
import { parseJson } from "../lib/json";

export type { NotificationType };

/**
 * Record notifications for the Inbox. The actor never notifies themselves, and people who muted
 * this type in their notification settings are skipped.
 */
export async function notify(
  tx: Tx,
  input: {
    userIds: Iterable<string>;
    type: NotificationType;
    workspaceId: string;
    actorId: string;
    taskId?: string;
    data?: Record<string, unknown>;
  },
) {
  const candidates = [...new Set(input.userIds)].filter((id) => id !== input.actorId);
  if (candidates.length === 0) return;
  const memberships = await tx.membership.findMany({
    where: { workspaceId: input.workspaceId, userId: { in: candidates } },
    select: { userId: true, notifyPrefs: true },
  });
  const recipients = memberships
    .filter((m) => parseJson<Partial<NotificationPrefs>>(m.notifyPrefs, {})[input.type] !== false)
    .map((m) => m.userId);
  if (recipients.length === 0) return;
  await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: input.type,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      taskId: input.taskId,
      data: JSON.stringify(input.data ?? {}),
    })),
  });
}
