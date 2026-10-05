import { errorMessage } from "@tp/data-stores";
import { FileText, Loader2, Paperclip, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { DotBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { docStore, useDocs } from "@/hooks/use-docs";
import { useClients, useWorkspaceId } from "@/hooks/use-workspace";
import { timeAgo } from "@/lib/dates";
import { formatBytes, readAsBase64, tooBig } from "../../lib/files";

export function DocsListPage() {
  const wid = useWorkspaceId();
  const { data, status, error } = useDocs(wid);
  const clients = useClients(wid);
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"new" | "upload" | null>(null);
  const [clientFilter, setClientFilter] = useState("all");

  const newDoc = async () => {
    setBusy("new");
    try {
      const doc = await docStore().create(wid, { title: "Untitled doc" });
      navigate(doc.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (tooBig(file)) return void toast.error(`${file.name} is ${formatBytes(file.size)}. Files can be at most 5 MB.`);
    setBusy("upload");
    try {
      await docStore().upload(wid, {
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        dataBase64: await readAsBase64(file),
        clientId: clientFilter === "all" ? null : clientFilter,
      });
      toast.success(`Uploaded ${file.name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const docs = (data ?? []).filter((d) => clientFilter === "all" || d.clientId === clientFilter);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Docs</h1>
        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-8 w-36" aria-label="Filter by client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <input ref={fileInput} type="file" className="hidden" aria-label="Choose a file to upload" onChange={(e) => void upload(e.target.files)} />
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
            {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />} Upload document
          </Button>
          <Button size="sm" disabled={busy !== null} onClick={newDoc}>
            <Plus /> New doc
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {status === "loading" || status === "idle" ? (
          <Loader2 className="mx-auto mt-10 size-5 animate-spin text-muted-foreground" aria-label="Loading docs" />
        ) : status === "error" ? (
          <p className="text-sm text-destructive">Couldn't load docs: {errorMessage(error)}</p>
        ) : docs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {clientFilter === "all" ? "No docs yet. Write one, or upload a file to share it with the team." : "No docs for this client yet."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {docs.map((d) => {
              const client = d.clientId ? clientMap.get(d.clientId) : undefined;
              const Icon = d.kind === "file" ? Paperclip : FileText;
              return (
                <li key={d.id}>
                  <Link to={d.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate">{d.title}</span>
                    {client && <DotBadge color={client.color}>{client.name}</DotBadge>}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {d.kind === "file" && d.fileSize !== null && `${formatBytes(d.fileSize)} · `}
                      {d.createdBy.name} · {timeAgo(d.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
