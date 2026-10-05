import { ApiError, type StoreHttp } from "@tp/data-stores";
import axios, { type AxiosError } from "axios";

/**
 * Axios transport for the domain stores. Unwraps response bodies and turns failures into ApiError.
 * The API sits behind Vite's /api proxy, so the session cookie is same-origin.
 */
export function createHttp(onUnauthorized: () => void): StoreHttp {
  const client = axios.create({
    baseURL: "/api",
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
    timeout: 20_000,
  });

  const wrap = async <T>(p: Promise<{ data: T }>): Promise<T> => {
    try {
      return (await p).data;
    } catch (e) {
      const err = e as AxiosError;
      const status = err.response?.status ?? 0;
      const url = err.config?.url ?? "";
      if (status === 401 && !url.startsWith("/auth/")) onUnauthorized();
      throw ApiError.from(status, err.response?.data);
    }
  };

  return {
    get: (url) => wrap(client.get(url)),
    post: (url, body) => wrap(client.post(url, body ?? {})),
    patch: (url, body) => wrap(client.patch(url, body ?? {})),
    delete: (url, body) => wrap(client.delete(url, body === undefined ? undefined : { data: body })),
  };
}
