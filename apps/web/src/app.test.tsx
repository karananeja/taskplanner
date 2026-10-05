import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeMe } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { fakeApi } from "@/test/server";

describe("routing", () => {
  it("sends signed-out visitors to sign in", async () => {
    fakeApi.me = null;
    renderApp("/w/ws_1/tasks");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends people without a workspace to onboarding", async () => {
    fakeApi.me = makeMe({ workspaces: [] });
    renderApp("/");
    expect(await screen.findByText("Start a workspace")).toBeInTheDocument();
    expect(screen.getByText("Join your team")).toBeInTheDocument();
  });

  it("opens the first workspace's Home from the root URL", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { name: /^Good (morning|afternoon|evening), Karan$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/w/ws_1/settings");
  });

  it("redirects away from a workspace you're not in", async () => {
    renderApp("/w/someone-elses/tasks");
    expect(await screen.findByRole("heading", { name: /^Good / })).toBeInTheDocument();
  });
});
