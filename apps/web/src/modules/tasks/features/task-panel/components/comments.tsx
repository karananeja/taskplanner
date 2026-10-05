import { errorMessage } from "@tp/data-stores";
import type { Comment, Member } from "@tp/shared";
import { Loader2 } from "lucide-react";
import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useMe } from "@/hooks/use-auth";
import { taskStore, useComments } from "@/hooks/use-tasks";
import { useMemberMap, useMembers, useWorkspaceDetail } from "@/hooks/use-workspace";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function Comments({ wid, taskId }: { wid: string; taskId: string }) {
  const comments = useComments(wid, taskId);
  const myId = useMe().data?.user.id;
  const isWorkspaceOwner = useWorkspaceDetail(wid).data?.myRole === "OWNER";
  const memberMap = useMemberMap(wid);

  const remove = async (c: Comment) => {
    try {
      await taskStore().deleteComment(wid, taskId, c.id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section>
      <h3 className="mb-3 text-sm font-medium">Comments</h3>
      {comments.status === "loading" && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading comments" />}
      {comments.data && comments.data.length > 0 && (
        <ol className="mb-4 flex flex-col gap-4">
          {comments.data.map((c) => (
            <li key={c.id} className="group flex gap-2.5">
              <Avatar user={c.author} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-[13px]">
                  <span className="font-medium">{c.author.name}</span>
                  <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)} className="text-xs text-muted-foreground">
                    {timeAgo(c.createdAt)}
                  </time>
                  {(c.author.id === myId || isWorkspaceOwner) && (
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    >
                      Delete
                    </button>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                  <CommentBody comment={c} members={memberMap} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Composer wid={wid} taskId={taskId} />
    </section>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Highlight @Name for people who were actually mentioned. */
function CommentBody({ comment, members }: { comment: Comment; members: Map<string, Member> }) {
  const names = comment.mentionIds.map((id) => members.get(id)?.name).filter((n): n is string => Boolean(n));
  if (names.length === 0) return <>{comment.body}</>;
  const re = new RegExp(`(@(?:${names.sort((a, b) => b.length - a.length).map(escapeRe).join("|")}))`, "g");
  return (
    <>
      {comment.body.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded bg-accent px-0.5 font-medium text-accent-foreground">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Composer({ wid, taskId }: { wid: string; taskId: string }) {
  const members = useMembers(wid);
  const myId = useMe().data?.user.id;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<{ text: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  // Caret position to restore after inserting a mention, applied before the browser paints
  // so the next keystroke lands after the inserted name.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [body]);

  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return members.filter((m) => m.id !== myId && m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, members, myId]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = /(^|\s)@([^\s@]*)$/.exec(before);
    setQuery(match ? { text: match[2]!, start: caret - match[2]!.length - 1 } : null);
    setHighlight(0);
  };

  const pick = (m: Member) => {
    if (!query || !ref.current) return;
    const caret = ref.current.selectionStart;
    const insert = `@${m.name} `;
    const next = body.slice(0, query.start) + insert + body.slice(caret);
    setBody(next);
    setMentioned((s) => new Set(s).add(m.id));
    setQuery(null);
    pendingCaret.current = query.start + insert.length;
    ref.current.focus();
  };

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const mentionIds = members.filter((m) => mentioned.has(m.id) && text.includes(`@${m.name}`)).map((m) => m.id);
      await taskStore().addComment(wid, taskId, text, mentionIds);
      setBody("");
      setMentioned(new Set());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (query && suggestions.length > 0) {
      if (e.key === "ArrowDown") return e.preventDefault(), setHighlight((h) => (h + 1) % suggestions.length);
      if (e.key === "ArrowUp") return e.preventDefault(), setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
      if (e.key === "Enter" || e.key === "Tab") return e.preventDefault(), pick(suggestions[highlight]!);
      if (e.key === "Escape") return e.preventDefault(), setQuery(null);
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const open = query !== null && suggestions.length > 0;

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        rows={3}
        value={body}
        disabled={sending}
        placeholder="Write a comment… type @ to mention someone"
        aria-label="Write a comment"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? "mention-list" : undefined}
        onChange={(e) => {
          setBody(e.target.value);
          detectMention(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => detectMention(body, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
      />
      {open && (
        <ul id="mention-list" role="listbox" className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border bg-popover p-1 shadow-lg">
          {suggestions.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]", i === highlight && "bg-muted")}
              >
                <Avatar user={m} />
                <span className="truncate">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ctrl + Enter to send</span>
        <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
