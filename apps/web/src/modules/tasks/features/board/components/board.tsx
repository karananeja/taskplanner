import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { errorMessage } from "@tp/data-stores";
import { STATUS_LABELS, TASK_STATUSES, type TaskCard, type TaskStatus } from "@tp/shared";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { taskStore } from "@/hooks/use-tasks";
import { useClients, useLabels, useMemberMap } from "@/hooks/use-workspace";
import { BoardColumn } from "./board-column";
import { type CardLookups, TaskCardView } from "./task-card";

type ColumnIds = Record<TaskStatus, string[]>;

const toIds = (columns: Record<TaskStatus, TaskCard[]>): ColumnIds =>
  Object.fromEntries(TASK_STATUSES.map((s) => [s, columns[s].map((t) => t.id)])) as ColumnIds;

/**
 * Whatever is under the pointer wins, preferring a card over its column, so dropping into
 * a column's empty space works wherever the card was grabbed. Keyboard drags have no
 * pointer and fall back to the nearest corners.
 */
const kanbanCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) {
    const cards = hits.filter((h) => !String(h.id).startsWith("column:"));
    return cards.length > 0 ? cards : hits;
  }
  return closestCorners(args);
};

function findContainer(cols: ColumnIds, id: string): TaskStatus | undefined {
  if (id.startsWith("column:")) return id.slice("column:".length) as TaskStatus;
  return TASK_STATUSES.find((s) => cols[s].includes(id));
}

export function Board({
  wid,
  columns,
  onOpen,
}: {
  wid: string;
  columns: Record<TaskStatus, TaskCard[]>;
  onOpen: (id: string) => void;
}) {
  const members = useMemberMap(wid);
  const labelsList = useLabels(wid);
  const clientsList = useClients(wid);
  const lookups: CardLookups = useMemo(
    () => ({
      members,
      labels: new Map(labelsList.map((l) => [l.id, l])),
      clients: new Map(clientsList.map((c) => [c.id, c])),
    }),
    [members, labelsList, clientsList],
  );

  const byId = useMemo(() => new Map(TASK_STATUSES.flatMap((s) => columns[s].map((t) => [t.id, t] as const))), [columns]);
  const serverIds = useMemo(() => toIds(columns), [columns]);

  // While dragging, the board shows a local arrangement; otherwise it's derived from the store.
  const [drag, setDrag] = useState<{ activeId: string; from: TaskStatus; fromIndex: number; cols: ColumnIds } | null>(null);
  const cols = drag?.cols ?? serverIds;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    const from = findContainer(serverIds, id);
    if (!from) return;
    setDrag({ activeId: id, from, fromIndex: serverIds[from].indexOf(id), cols: serverIds });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!drag || !over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const src = findContainer(drag.cols, activeId);
    const dst = findContainer(drag.cols, overId);
    if (!src || !dst || src === dst) return;
    setDrag((d) => {
      if (!d) return d;
      const srcItems = d.cols[src].filter((id) => id !== activeId);
      const dstItems = [...d.cols[dst]];
      const overIndex = dstItems.indexOf(overId);
      dstItems.splice(overIndex >= 0 ? overIndex : dstItems.length, 0, activeId);
      return { ...d, cols: { ...d.cols, [src]: srcItems, [dst]: dstItems } };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!drag) return;
    const activeId = String(active.id);
    let finalCols = drag.cols;
    if (over) {
      const container = findContainer(finalCols, activeId);
      const overId = String(over.id);
      if (container && findContainer(finalCols, overId) === container && overId !== activeId && !overId.startsWith("column:")) {
        const items = finalCols[container];
        finalCols = { ...finalCols, [container]: arrayMove(items, items.indexOf(activeId), items.indexOf(overId)) };
      }
    }
    const status = findContainer(finalCols, activeId);
    const index = status ? finalCols[status].indexOf(activeId) : -1;
    const unchanged = !over || !status || (status === drag.from && index === drag.fromIndex);

    if (!unchanged && status) {
      const list = finalCols[status];
      const beforeId = list[index - 1] ?? null;
      const afterId = list[index + 1] ?? null;
      // The store applies the move optimistically before this returns, so clearing the drag
      // state right after doesn't flash the old position.
      taskStore()
        .move(wid, activeId, { status, beforeId, afterId })
        .then((res) => {
          if (res.result === "requested") {
            toast.info("Change request sent", {
              description: `You're not an owner or assignee, so moving it to ${STATUS_LABELS[status]} needs an owner's approval.`,
            });
          }
        })
        .catch((e) => toast.error(errorMessage(e)));
    }
    setDrag(null);
  };

  const activeTask = drag ? byId.get(drag.activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To pick up a task, press space or enter. Use the arrow keys to move it, space or enter to drop, escape to cancel.",
        },
      }}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-5 pb-4">
        {TASK_STATUSES.map((s) => (
          <BoardColumn key={s} wid={wid} status={s} ids={cols[s]} byId={byId} lookups={lookups} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
        {activeTask ? <TaskCardView task={activeTask} lookups={lookups} className="w-68 rotate-1 shadow-2xl ring-1 ring-primary/40" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
