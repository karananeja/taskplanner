import type * as React from "react";
import { cn } from "@/lib/utils";

/** Pill with a coloured dot — priorities, labels and clients all use it. */
export function DotBadge({ color, className, children, ...props }: React.ComponentProps<"span"> & { color: string }) {
  return (
    <span
      className={cn("inline-flex h-5 max-w-full items-center gap-1.5 rounded-full border px-2 text-[11px] leading-none text-muted-foreground", className)}
      {...props}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Filled tint for labels, like the settings screen. */
export function TintBadge({ color, className, children, ...props }: React.ComponentProps<"span"> & { color: string }) {
  return (
    <span
      className={cn("inline-flex h-5 max-w-full items-center rounded-full px-2 text-[11px] font-medium leading-none", className)}
      style={{ backgroundColor: `${color}26`, color }}
      {...props}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
