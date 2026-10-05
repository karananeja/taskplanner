import { SWATCHES } from "@tp/shared";
import { cn } from "@/lib/utils";

export function SwatchPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", value === c && "ring-2 ring-foreground")}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
