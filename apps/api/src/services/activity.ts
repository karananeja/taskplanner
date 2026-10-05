import type { ActivityData } from "@tp/shared";
import type { Tx } from "../db";

export async function logActivity(tx: Tx, taskId: string, actorId: string, data: ActivityData) {
  const { type, ...rest } = data;
  await tx.activity.create({ data: { taskId, actorId, type, data: JSON.stringify(rest) } });
}
