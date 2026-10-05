import type { ApiErrorBody } from "@tp/shared";

/**
 * Transport injected into every store. Implementations return the already-unwrapped
 * response body and throw `ApiError` for non-2xx responses.
 */
export interface StoreHttp {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, body?: unknown): Promise<T>;
  patch<T>(url: string, body?: unknown): Promise<T>;
  delete<T = void>(url: string, body?: unknown): Promise<T>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly body?: unknown,
  ) {
    super(message);
  }

  static from(status: number, body: unknown): ApiError {
    const e = (body as Partial<ApiErrorBody> | undefined)?.error;
    if (e?.message) return new ApiError(status, e.code ?? "error", e.message, e.fields ?? {}, body);
    if (status === 0) return new ApiError(0, "network", "Can't reach the server. Check that the API is running.");
    return new ApiError(status, "error", `The server responded with an error (${status}).`, {}, body);
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Try again.";
}
