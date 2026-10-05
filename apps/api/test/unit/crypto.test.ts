import { describe, expect, it } from "vitest";
import { hashPassword, inviteCode, sha256, verifyPassword } from "../../src/lib/crypto";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt\$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("tokens", () => {
  it("makes invite codes without look-alike characters", () => {
    const code = inviteCode(200);
    expect(code).toHaveLength(200);
    expect(code).not.toMatch(/[01ilo]/);
  });

  it("hashes deterministically", () => {
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).toHaveLength(64);
  });
});
