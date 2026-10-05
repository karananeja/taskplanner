import type * as React from "react";
import { cn } from "@/lib/utils";

/** Pressable pill used for picking people and labels. */
export function ToggleChip({
  pressed,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        pressed
          ? "border-primary bg-primary/15 font-medium text-foreground"
          : "border-dashed border-border text-muted-foreground hover:border-input hover:text-foreground [&>span:first-child]:opacity-40 [&>span:first-child]:grayscale",
        className,
      )}
      {...props}
    />
  );
}
