import type { Query, QueryClient } from "@tp/query";
import type { CreateDocInput, DocDetail, DocSummary, UpdateDocInput, UploadDocInput } from "@tp/shared";
import type { StoreHttp } from "./http";

const base = (wid: string) => `/workspaces/${encodeURIComponent(wid)}/docs`;
const one = (wid: string, id: string) => `${base(wid)}/${encodeURIComponent(id)}`;

function toSummary(d: DocDetail): DocSummary {
  const { body, ...summary } = d;
  void body;
  return summary;
}

/** Written docs and uploaded files for a workspace. */
export class DocStore {
  constructor(
    private http: StoreHttp,
    private queries: QueryClient,
  ) {}

  list(wid: string): Query<DocSummary[]> {
    return this.queries.query(["ws", wid, "docs"], () => this.http.get<DocSummary[]>(base(wid)), { staleTime: 10_000 });
  }

  doc(wid: string, id: string): Query<DocDetail> {
    return this.queries.query(["ws", wid, "doc", id], () => this.http.get<DocDetail>(one(wid, id)), {
      staleTime: 5_000,
      refetchOnFocus: false,
    });
  }

  /** Where the browser downloads an uploaded file from. */
  fileUrl(wid: string, id: string) {
    return `/api${one(wid, id)}/file`;
  }

  async create(wid: string, input: CreateDocInput) {
    const doc = await this.http.post<DocDetail>(base(wid), input);
    this.doc(wid, doc.id).setData(doc);
    this.upsert(wid, toSummary(doc));
    this.touchClients(wid);
    return doc;
  }

  async upload(wid: string, input: UploadDocInput) {
    const doc = await this.http.post<DocSummary>(`${base(wid)}/upload`, input);
    this.upsert(wid, doc);
    this.touchClients(wid);
    return doc;
  }

  async update(wid: string, id: string, changes: UpdateDocInput) {
    const doc = await this.http.patch<DocDetail>(one(wid, id), changes);
    this.doc(wid, id).setData(doc);
    this.upsert(wid, toSummary(doc));
    if (changes.clientId !== undefined) this.touchClients(wid);
    return doc;
  }

  async remove(wid: string, id: string) {
    await this.http.delete(one(wid, id));
    this.list(wid).setData((prev) => (prev ?? []).filter((d) => d.id !== id));
    this.touchClients(wid);
  }

  private upsert(wid: string, doc: DocSummary) {
    const q = this.queries.peek<DocSummary[]>(["ws", wid, "docs"]);
    if (!q?.getSnapshot().data) return;
    q.setData((prev) => [doc, ...(prev ?? []).filter((d) => d.id !== doc.id)]);
  }

  /** Client doc counts changed. */
  private touchClients(wid: string) {
    this.queries.invalidate(["ws", wid, "clients"]);
  }
}
