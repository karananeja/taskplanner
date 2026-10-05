import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, ORIGIN, signUp } from "../helpers";

describe("auth", () => {
  it("signs up, returns the user with no workspaces, and keeps them signed in", async () => {
    const u = await signUp("Ada");
    const me = await u.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ user: { name: "Ada", email: u.email }, workspaces: [] });
  });

  it("never exposes the password hash", async () => {
    const u = await signUp("Hash");
    expect(JSON.stringify((await u.get("/auth/me")).body)).not.toContain("scrypt");
  });

  it("refuses a second account with the same email", async () => {
    const u = await signUp("Dup");
    const res = await request(app).post("/api/auth/signup").set("Origin", ORIGIN).send({ name: "Dup", email: u.email, password: "password123" });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toBeDefined();
  });

  it("logs in with the right password and normalises email case", async () => {
    const u = await signUp("Case");
    const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: u.email.toUpperCase(), password: "password123" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/tp_session=.*HttpOnly.*SameSite=Lax/i);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const u = await signUp("Wrong");
    const wrong = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: u.email, password: "nope-nope" });
    const unknown = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "nobody@example.com", password: "nope-nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("returns field errors for invalid signup input", async () => {
    const res = await request(app).post("/api/auth/signup").set("Origin", ORIGIN).send({ name: "", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["email", "name", "password"]);
  });

  it("requires a session for protected routes", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/workspaces/anything")).status).toBe(401);
  });

  it("ends the session on logout", async () => {
    const u = await signUp("Temp");
    expect((await u.post("/auth/logout")).status).toBe(204);
    expect((await u.get("/auth/me")).status).toBe(401);
  });

  it("reports whether Google sign-in is configured", async () => {
    expect((await request(app).get("/api/auth/config")).body).toEqual({ google: false });
  });
});

describe("request guards", () => {
  it("blocks state-changing requests from another site", async () => {
    const u = await signUp("Csrf");
    const res = await u.agent.post("/api/workspaces").set("Origin", "https://evil.example").send({ name: "x" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("bad_origin");
  });

  it("rejects non-JSON bodies", async () => {
    const u = await signUp("Form");
    const res = await u.agent.post("/api/workspaces").set("Origin", ORIGIN).type("form").send("name=x");
    expect(res.status).toBe(415);
  });

  it("answers unknown endpoints with a JSON 404", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
