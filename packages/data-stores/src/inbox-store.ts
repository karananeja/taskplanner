import type { Query, QueryClient } from "@tp/query";
import type { Notification, NotificationPrefs } from "@tp/shared";
import type { StoreHttp } from "./http";

const base = (wid: string) => `/workspaces/${encodeURIComponent(wid)}/notifications`;

/** The signed-in person's notifications in one workspace, with optimistic read/unread. */
export class InboxStore {
  constructor(
    private http: StoreHttp,
    private queries: QueryClient,
  ) {}

  list(wid: string): Query<Notification[]> {
    return this.queries.query(["ws", wid, "inbox"], () => this.http.get<Notification[]>(base(wid)), {
      staleTime: 5_000,
      pollInterval: 30_000,
    });
  }

  settings(wid: string): Query<NotificationPrefs> {
    return this.queries.query(["ws", wid, "inbox-settings"], () => this.http.get<NotificationPrefs>(`${base(wid)}/settings`), {
      staleTime: 60_000,
    });
  }

  async markRead(wid: string, id: string, read = true) {
    const q = this.list(wid);
    const prev = q.getSnapshot().data;
    const readAt = read ? new Date().toISOString() : null;
    if (prev) q.setData(prev.map((n) => (n.id === id ? { ...n, readAt } : n)));
    try {
      await this.http.post(`${base(wid)}/${encodeURIComponent(id)}/${read ? "read" : "unread"}`);
    } catch (e) {
      if (prev) q.setData(prev);
      throw e;
    }
  }

  async markAllRead(wid: string) {
    const q = this.list(wid);
    const prev = q.getSnapshot().data;
    const now = new Date().toISOString();
    if (prev) q.setData(prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    try {
      await this.http.post(`${base(wid)}/read-all`);
    } catch (e) {
      if (prev) q.setData(prev);
      throw e;
    }
  }

  async updateSettings(wid: string, changes: Partial<NotificationPrefs>) {
    const prefs = await this.http.patch<NotificationPrefs>(`${base(wid)}/settings`, changes);
    this.settings(wid).setData(prefs);
    return prefs;
  }
}
