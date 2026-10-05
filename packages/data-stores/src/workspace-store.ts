import type { Query, QueryClient } from "@tp/query";
import type {
  Client,
  CreateClientInput,
  CreateLabelInput,
  Label,
  Me,
  ReviewItem,
  WorkspaceDetail,
} from "@tp/shared";
import type { AuthStore } from "./auth-store";
import type { StoreHttp } from "./http";

const ws = (id: string) => `/workspaces/${encodeURIComponent(id)}`;

export class WorkspaceStore {
  constructor(
    private http: StoreHttp,
    private queries: QueryClient,
    private auth: AuthStore,
  ) {}

  detail(workspaceId: string): Query<WorkspaceDetail> {
    return this.queries.query(["ws", workspaceId, "detail"], () => this.http.get<WorkspaceDetail>(ws(workspaceId)), {
      staleTime: 30_000,
      pollInterval: 60_000,
    });
  }

  labels(workspaceId: string): Query<Label[]> {
    return this.queries.query(["ws", workspaceId, "labels"], () => this.http.get<Label[]>(`${ws(workspaceId)}/labels`), {
      staleTime: 30_000,
    });
  }

  clients(workspaceId: string): Query<Client[]> {
    return this.queries.query(["ws", workspaceId, "clients"], () => this.http.get<Client[]>(`${ws(workspaceId)}/clients`), {
      staleTime: 30_000,
    });
  }

  /** Pending change requests on tasks you own, for Home. */
  reviewQueue(workspaceId: string): Query<ReviewItem[]> {
    return this.queries.query(["ws", workspaceId, "review-queue"], () => this.http.get<ReviewItem[]>(`${ws(workspaceId)}/review-queue`), {
      staleTime: 5_000,
      pollInterval: 30_000,
    });
  }

  async create(name: string) {
    const res = await this.http.post<{ workspaceId: string; me: Me }>("/workspaces", { name });
    this.auth.setMe(res.me);
    return res.workspaceId;
  }

  async join(inviteCode: string) {
    const res = await this.http.post<{ workspaceId: string; me: Me }>("/workspaces/join", { inviteCode });
    this.auth.setMe(res.me);
    return res.workspaceId;
  }

  async rename(workspaceId: string, name: string) {
    await this.http.patch(ws(workspaceId), { name });
    this.detail(workspaceId).setData((d) => (d ? { ...d, name } : d!));
    void this.auth.me.refetch();
  }

  async regenerateInviteCode(workspaceId: string) {
    const { inviteCode } = await this.http.post<{ inviteCode: string }>(`${ws(workspaceId)}/invite-code`);
    this.detail(workspaceId).setData((d) => (d ? { ...d, inviteCode } : d!));
  }

  async removeMember(workspaceId: string, userId: string) {
    await this.http.delete(`${ws(workspaceId)}/members/${encodeURIComponent(userId)}`);
    this.queries.invalidate(["ws", workspaceId]);
  }

  async leave(workspaceId: string) {
    const me = await this.http.post<Me>(`${ws(workspaceId)}/leave`);
    this.auth.setMe(me);
  }

  /** Owner only. Resolves to the updated workspace list. */
  async deleteWorkspace(workspaceId: string, confirmName: string) {
    const me = await this.http.delete<Me>(ws(workspaceId), { confirmName });
    this.auth.setMe(me);
    return me;
  }

  async addLabel(workspaceId: string, input: CreateLabelInput) {
    const label = await this.http.post<Label>(`${ws(workspaceId)}/labels`, input);
    this.labels(workspaceId).setData((prev) => [...(prev ?? []), label].sort((a, b) => a.name.localeCompare(b.name)));
    return label;
  }

  async removeLabel(workspaceId: string, labelId: string) {
    await this.http.delete(`${ws(workspaceId)}/labels/${encodeURIComponent(labelId)}`);
    this.labels(workspaceId).setData((prev) => (prev ?? []).filter((l) => l.id !== labelId));
    this.queries.invalidate(["ws", workspaceId, "tasks"]);
  }

  async addClient(workspaceId: string, input: CreateClientInput) {
    const client = await this.http.post<Client>(`${ws(workspaceId)}/clients`, input);
    this.clients(workspaceId).setData((prev) => [...(prev ?? []), client].sort((a, b) => a.name.localeCompare(b.name)));
    return client;
  }

  async removeClient(workspaceId: string, clientId: string) {
    await this.http.delete(`${ws(workspaceId)}/clients/${encodeURIComponent(clientId)}`);
    this.clients(workspaceId).setData((prev) => (prev ?? []).filter((c) => c.id !== clientId));
    this.queries.invalidate(["ws", workspaceId, "tasks"]);
  }
}
