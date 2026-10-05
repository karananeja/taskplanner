import { Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 rounded-md border p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            "flex h-7 items-center justify-center gap-1 rounded-[5px] text-xs transition-colors",
            theme === o.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <o.icon className="size-3" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}
