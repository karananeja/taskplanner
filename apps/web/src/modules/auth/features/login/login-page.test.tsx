import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test/render";
import { fakeApi, sent } from "@/test/server";

describe("sign in", () => {
  it("validates before calling the server", async () => {
    fakeApi.me = null;
    const { user } = renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(sent("POST", "/auth/login")).toHaveLength(0);
  });

  it("shows the server's message for wrong credentials", async () => {
    fakeApi.me = null;
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "karan@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match.");
  });

  it("signs in and lands on Home", async () => {
    fakeApi.me = null;
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "Karan@Example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: /^Good / })).toBeInTheDocument();
    expect(sent("POST", "/auth/login")[0]?.body).toEqual({ email: "karan@example.com", password: "password123" });
  });

  it("shows and hides the password", async () => {
    fakeApi.me = null;
    const { user } = renderApp("/login");
    const field = await screen.findByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("shows Google sign-in only when the server supports it", async () => {
    fakeApi.me = null;
    fakeApi.config = { google: true };
    renderApp("/login");
    expect(await screen.findByRole("link", { name: /Continue with Google/ })).toHaveAttribute("href", "/api/auth/google");
  });
});
