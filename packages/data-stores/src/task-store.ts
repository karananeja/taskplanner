import type { Query, QueryClient } from "@tp/query";
import {
  type Activity,
  type Comment,
  type CreateTaskInput,
  type MoveTaskInput,
  type TaskCard,
  type TaskChanges,
  type TaskDetail,
  type TaskStatus,
  type UpdateTaskResult,
  positionBetween,
} from "@tp/shared";
import type { ChangeRequest } from "@tp/shared";
import { isApiError, type StoreHttp } from "./http";

export const BOARD_POLL_MS = 20_000;

const base = (wid: string) => `/workspaces/${encodeURIComponent(wid)}/tasks`;
const one = (wid: string, id: string) => `${base(wid)}/${encodeURIComponent(id)}`;

export type MoveResult =
  | { result: "applied"; task: TaskCard }
  | { result: "requested"; task: TaskCard; changeRequest: ChangeRequest };

/** Strip detail-only fields so a detail response can refresh its board card. */
function toCard(d: TaskDetail): TaskCard {
  const { description, checklist, subtasks, pendingChangeRequests, permissions, updatedAt, ...card } = d;
  void description, checklist, subtasks, pendingChangeRequests, permissions, updatedAt;
  return card;
}

export class TaskStore {
  constructor(
    private http: StoreHttp,
    private queries: QueryClient,
  ) {}

  // Queries

  board(wid: string): Query<TaskCard[]> {
    return this.queries.query(["ws", wid, "tasks"], () => this.http.get<TaskCard[]>(base(wid)), {
      staleTime: 5_000,
      pollInterval: BOARD_POLL_MS,
    });
  }

  task(wid: string, id: string): Query<TaskDetail> {
    return this.queries.query(["ws", wid, "task", id], () => this.http.get<TaskDetail>(one(wid, id)), {
      staleTime: 5_000,
      pollInterval: BOARD_POLL_MS,
    });
  }

  comments(wid: string, id: string): Query<Comment[]> {
    return this.queries.query(["ws", wid, "task", id, "comments"], () => this.http.get<Comment[]>(`${one(wid, id)}/comments`), {
      staleTime: 5_000,
      pollInterval: BOARD_POLL_MS,
    });
  }

  activity(wid: string, id: string): Query<Activity[]> {
    return this.queries.query(["ws", wid, "task", id, "activity"], () => this.http.get<Activity[]>(`${one(wid, id)}/activity`), {
      staleTime: 0,
    });
  }

  // Mutations

  async create(wid: string, input: CreateTaskInput): Promise<TaskDetail> {
    const detail = await this.http.post<TaskDetail>(base(wid), input);
    const parentId = input.parentId ?? null;
    this.board(wid).setData((prev) => [
      ...(prev ?? []).map((t) => (t.id === parentId ? { ...t, subtaskCount: t.subtaskCount + 1 } : t)),
      toCard(detail),
    ]);
    this.task(wid, detail.id).setData(detail);
    if (parentId) this.queries.invalidate(["ws", wid, "task", parentId]);
    return detail;
  }

  async update(wid: string, id: string, baseVersion: number, changes: TaskChanges): Promise<UpdateTaskResult> {
    try {
      const res = await this.http.patch<UpdateTaskResult>(one(wid, id), { baseVersion, changes });
      this.receiveDetail(wid, res.task);
      return res;
    } catch (e) {
      // Someone else saved first: pull the latest so the form can show it.
      if (isApiError(e) && e.status === 409) this.queries.invalidate(["ws", wid, "task", id]);
      throw e;
    }
  }

  /**
   * Optimistic drag and drop. The card moves immediately; if the server turns the move into a
   * change request, or fails, the board snaps back.
   */
  async move(wid: string, id: string, input: MoveTaskInput): Promise<MoveResult> {
    const board = this.board(wid);
    const snapshot = board.getSnapshot().data;
    if (snapshot) {
      const pos = (tid: string | null) => (tid ? (snapshot.find((t) => t.id === tid)?.position ?? null) : null);
      const position = positionBetween(pos(input.beforeId), pos(input.afterId));
      board.setData(snapshot.map((t) => (t.id === id ? { ...t, status: input.status, position } : t)));
    }
    try {
      const res = await this.http.post<MoveResult>(`${one(wid, id)}/move`, input);
      if (res.result === "applied") {
        board.setData((prev) => (prev ?? []).map((t) => (t.id === id ? res.task : t)));
        this.queries.invalidate(["ws", wid, "task", id]);
      } else {
        if (snapshot) board.setData(snapshot);
        this.queries.invalidate(["ws", wid, "task", id]);
      }
      return res;
    } catch (e) {
      if (snapshot) board.setData(snapshot);
      void board.refetch();
      throw e;
    }
  }

  async remove(wid: string, id: string) {
    const board = this.board(wid);
    const snapshot = board.getSnapshot().data;
    const parentId = snapshot?.find((t) => t.id === id)?.parent?.id;
    board.setData((prev) =>
      (prev ?? [])
        .filter((t) => t.id !== id && t.parent?.id !== id)
        .map((t) => (t.id === parentId ? { ...t, subtaskCount: Math.max(0, t.subtaskCount - 1) } : t)),
    );
    try {
      await this.http.delete(one(wid, id));
    } catch (e) {
      if (snapshot) board.setData(snapshot);
      throw e;
    }
    if (parentId) this.queries.invalidate(["ws", wid, "task", parentId]);
  }

  async addChecklistItem(wid: string, id: string, text: string) {
    return this.receiveDetail(wid, await this.http.post<TaskDetail>(`${one(wid, id)}/checklist`, { text }));
  }

  async toggleChecklistItem(wid: string, id: string, itemId: string, done: boolean) {
    const q = this.task(wid, id);
    const prev = q.getSnapshot().data;
    if (prev) q.setData({ ...prev, checklist: prev.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)) });
    try {
      return this.receiveDetail(wid, await this.http.patch<TaskDetail>(`${one(wid, id)}/checklist/${itemId}`, { done }));
    } catch (e) {
      if (prev) q.setData(prev);
      throw e;
    }
  }

  async removeChecklistItem(wid: string, id: string, itemId: string) {
    return this.receiveDetail(wid, await this.http.delete<TaskDetail>(`${one(wid, id)}/checklist/${itemId}`));
  }

  async approveChangeRequest(wid: string, id: string, requestId: string, note?: string) {
    return this.receiveDetail(wid, await this.http.post<TaskDetail>(`${one(wid, id)}/change-requests/${requestId}/approve`, { note }));
  }

  async rejectChangeRequest(wid: string, id: string, requestId: string, note?: string) {
    return this.receiveDetail(wid, await this.http.post<TaskDetail>(`${one(wid, id)}/change-requests/${requestId}/reject`, { note }));
  }

  async withdrawChangeRequest(wid: string, id: string, requestId: string) {
    return this.receiveDetail(wid, await this.http.delete<TaskDetail>(`${one(wid, id)}/change-requests/${requestId}`));
  }

  async addComment(wid: string, id: string, body: string, mentionIds: string[]) {
    const comment = await this.http.post<Comment>(`${one(wid, id)}/comments`, { body, mentionIds });
    this.comments(wid, id).setData((prev) => [...(prev ?? []), comment]);
    this.bumpCommentCount(wid, id, 1);
    this.queries.invalidate(["ws", wid, "task", id, "activity"]);
    return comment;
  }

  async deleteComment(wid: string, id: string, commentId: string) {
    await this.http.delete(`${one(wid, id)}/comments/${commentId}`);
    this.comments(wid, id).setData((prev) => (prev ?? []).filter((c) => c.id !== commentId));
    this.bumpCommentCount(wid, id, -1);
  }

  // Helpers

  /** Store a fresh detail response and refresh its card on the board. */
  private receiveDetail(wid: string, detail: TaskDetail): TaskDetail {
    this.task(wid, detail.id).setData(detail);
    const board = this.queries.peek<TaskCard[]>(["ws", wid, "tasks"]);
    if (board?.getSnapshot().data) {
      board.setData((prev) => (prev ?? []).map((t) => (t.id === detail.id ? toCard(detail) : t)));
    }
    this.queries.invalidate(["ws", wid, "task", detail.id, "activity"]);
    return detail;
  }

  private bumpCommentCount(wid: string, id: string, delta: number) {
    const board = this.queries.peek<TaskCard[]>(["ws", wid, "tasks"]);
    if (board?.getSnapshot().data) {
      board.setData((prev) => (prev ?? []).map((t) => (t.id === id ? { ...t, commentCount: Math.max(0, t.commentCount + delta) } : t)));
    }
  }
}

/** Board columns in display order, each sorted by position. Pure, so components derive it in render. */
export function groupByStatus(tasks: readonly TaskCard[], statuses: readonly TaskStatus[]) {
  const columns = Object.fromEntries(statuses.map((s) => [s, [] as TaskCard[]])) as Record<TaskStatus, TaskCard[]>;
  for (const t of tasks) columns[t.status]?.push(t);
  for (const s of statuses) columns[s].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  return columns;
}
