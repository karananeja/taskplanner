import { isApiError } from "@tp/data-stores";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

/** Put server field errors on the matching inputs; anything else becomes a toast or root error. */
export function applyServerError<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]) {
  if (isApiError(e)) {
    let placed = false;
    for (const [key, message] of Object.entries(e.fields)) {
      if ((fields as readonly string[]).includes(key)) {
        setError(key as Path<T>, { message });
        placed = true;
      }
    }
    if (!placed) setError("root", { message: e.message });
    return;
  }
  toast.error("Something went wrong. Try again.");
}
