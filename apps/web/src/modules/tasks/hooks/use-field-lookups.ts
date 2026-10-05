import { useMemo } from "react";
import { useClients, useLabels, useMemberMap } from "@/hooks/use-workspace";
import type { FieldLookups } from "../lib/format-field";

export function useFieldLookups(wid: string): FieldLookups {
  const members = useMemberMap(wid);
  const labels = useLabels(wid);
  const clients = useClients(wid);
  return useMemo(
    () => ({ members, labels: new Map(labels.map((l) => [l.id, l])), clients: new Map(clients.map((c) => [c.id, c])) }),
    [members, labels, clients],
  );
}
