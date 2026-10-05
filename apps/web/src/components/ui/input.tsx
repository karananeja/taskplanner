import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground/70 transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(inputClass, "[color-scheme:light] dark:[color-scheme:dark]", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(inputClass, "h-auto min-h-20 resize-y py-2 leading-relaxed", className)} {...props} />;
}

/** Password field with a button to show or hide what's typed. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
