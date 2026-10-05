import { signupSchema } from "@tp/shared";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../src/lib/errors";
import { parse } from "../../src/lib/validate";

describe("parse", () => {
  it("returns parsed data, trimmed and lower-cased", () => {
    expect(parse(signupSchema, { name: " Ada ", email: "ADA@X.COM", password: "password123" })).toEqual({
      name: "Ada",
      email: "ada@x.com",
      password: "password123",
    });
  });

  it("throws a 400 with one message per field", () => {
    try {
      parse(signupSchema, { name: "", email: "x", password: "1" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(400);
      expect(Object.keys((e as HttpError).fields ?? {}).sort()).toEqual(["email", "name", "password"]);
    }
  });
});
