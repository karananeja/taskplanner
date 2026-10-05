import { Loader2 } from "lucide-react";

export function FullPageMessage({ loading, title, body }: { loading?: boolean; title?: string; body?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      {loading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : (
        <div className="max-w-sm text-center">
          <h1 className="text-base font-semibold">{title}</h1>
          {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
        </div>
      )}
    </div>
  );
}
