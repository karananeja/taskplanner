import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { Query, QueryState } from "./query";

const IDLE: QueryState<never> = { data: undefined, error: undefined, status: "idle", isFetching: false, updatedAt: 0 };
const noopSubscribe = () => () => {};
const idleSnapshot = () => IDLE;

/** Subscribe a component to a query. Pass null to skip (e.g. while an id is unknown). */
export function useQuery<T>(query: Query<T> | null): QueryState<T> {
  return useSyncExternalStore(
    query ? query.subscribe : noopSubscribe,
    query ? query.getSnapshot : (idleSnapshot as () => QueryState<T>),
  );
}

/**
 * Subscribe to a derived slice. Re-renders only when `select` returns a value that isn't `isEqual`
 * to the previous one, so a card can watch a single task on a large board.
 */
export function useQuerySelector<T, S>(
  query: Query<T> | null,
  select: (data: T | undefined) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  const last = useRef<{ data: T | undefined; value: S } | null>(null);
  const getSnapshot = () => {
    const data = query?.getSnapshot().data;
    if (last.current && last.current.data === data) return last.current.value;
    const value = select(data);
    if (last.current && isEqual(last.current.value, value)) {
      last.current = { data, value: last.current.value };
      return last.current.value;
    }
    last.current = { data, value };
    return value;
  };
  return useSyncExternalStore(query ? query.subscribe : noopSubscribe, getSnapshot);
}

/** Track the pending/error state of a store action for the component that triggered it. */
export function useMutation<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [state, setState] = useState<{ isPending: boolean; error: unknown }>({ isPending: false, error: null });
  const actionRef = useRef(action);
  actionRef.current = action;
  const mutate = useCallback(async (...args: A): Promise<R> => {
    setState({ isPending: true, error: null });
    try {
      const result = await actionRef.current(...args);
      setState({ isPending: false, error: null });
      return result;
    } catch (error) {
      setState({ isPending: false, error });
      throw error;
    }
  }, []);
  const reset = useCallback(() => setState({ isPending: false, error: null }), []);
  return { mutate, reset, ...state };
}
