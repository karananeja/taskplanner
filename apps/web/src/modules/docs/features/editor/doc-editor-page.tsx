import { errorMessage, isApiError } from "@tp/data-stores";
import type { DocDetail } from "@tp/shared";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/hooks/use-auth";
import { docStore, useDoc } from "@/hooks/use-docs";
import { useClients, useWorkspaceDetail, useWorkspaceId } from "@/hooks/use-workspace";
import { formatDateTime } from "@/lib/dates";
import { formatBytes } from "../../lib/files";

const NO_CLIENT = "none";

export function DocEditorPage() {
  const wid = useWorkspaceId();
  const { docId } = useParams();
  const { data: doc, status, error } = useDoc(wid, docId ?? null);

  if (status === "error") {
    const gone = isApiError(error) && error.status === 404;
    return (
      <div className="p-5 text-sm">
        <BackLink />
        <p className="mt-4 text-muted-foreground">{gone ? "This doc was deleted or never existed." : `Couldn't load the doc: ${errorMessage(error)}`}</p>
      </div>
    );
  }
  if (!doc) return <Loader2 className="mx-auto mt-10 size-5 animate-spin text-muted-foreground" aria-label="Loading doc" />;
  return <Editor key={doc.id} wid={wid} doc={doc} />;
}

function BackLink() {
  return (
    <Link to=".." relative="path" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Docs
    </Link>
  );
}

function Editor({ wid, doc }: { wid: string; doc: DocDetail }) {
  const clients = useClients(wid);
  const myId = useMe().data?.user.id;
  const isWsOwner = useWorkspaceDetail(wid).data?.myRole === "OWNER";
  const navigate = useNavigate();
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [saving, setSaving] = useState(false);
  const isFile = doc.kind === "file";
  const dirty = title.trim() !== doc.title || (!isFile && body !== doc.body);
  const canDelete = doc.createdBy.id === myId || isWsOwner;

  const save = async () => {
    if (!dirty || !title.trim()) return;
    setSaving(true);
    try {
      await docStore().update(wid, doc.id, { title: title.trim(), ...(isFile ? {} : { body }) });
      toast.success("Saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Warn before leaving the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const setClient = async (value: string) => {
    try {
      await docStore().update(wid, doc.id, { clientId: value === NO_CLIENT ? null : value });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${doc.title}”? This can't be undone.`)) return;
    try {
      await docStore().remove(wid, doc.id);
      navigate("..", { relative: "path" });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <BackLink />
        <div className="flex items-center gap-2">
          <Select value={doc.clientId ?? NO_CLIENT} onValueChange={(v) => void setClient(v)}>
            <SelectTrigger className="h-8 w-40" aria-label="Client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLIENT}>No client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canDelete && (
            <Button size="icon" variant="ghost" aria-label="Delete doc" onClick={remove}>
              <Trash2 />
            </Button>
          )}
          <Button size="sm" disabled={!dirty || saving || !title.trim()} onClick={save}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3 px-5 py-6">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
          placeholder="Title"
          className="h-auto border-transparent px-0 text-2xl font-semibold focus-visible:border-transparent focus-visible:ring-0"
        />
        <p className="text-xs text-muted-foreground">
          Added by {doc.createdBy.name} · last updated {formatDateTime(doc.updatedAt)}
        </p>
        {isFile ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doc.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {doc.fileType} · {formatBytes(doc.fileSize ?? 0)}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={docStore().fileUrl(wid, doc.id)} download={doc.fileName ?? undefined}>
                <Download /> Download
              </a>
            </Button>
          </div>
        ) : (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Doc content"
            placeholder="Start writing… Meeting notes, specs, briefs — anything the team should keep."
            className="min-h-0 flex-1 resize-none border-transparent px-0 text-[15px] focus-visible:border-transparent focus-visible:ring-0"
          />
        )}
      </div>
    </div>
  );
}
