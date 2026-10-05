export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, "bad_request", message, fields);
export const unauthorized = (message = "Sign in to continue.") =>
  new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You don't have access to this.") =>
  new HttpError(403, "forbidden", message);
export const notFound = (what = "Item") => new HttpError(404, "not_found", `${what} not found.`);
export const conflict = (message: string, extra?: Record<string, unknown>) =>
  new HttpError(409, "conflict", message, undefined, extra);
