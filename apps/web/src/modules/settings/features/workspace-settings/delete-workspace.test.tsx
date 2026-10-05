import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeWorkspace } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { fakeApi, sent } from "@/test/server";

describe("deleting a workspace", () => {
  it("asks for the name, then sends you to onboarding when it was your only one", async () => {
    const { user } = renderApp("/w/ws_1/settings");
    await user.click(await screen.findByRole("button", { name: "Delete workspace" }));
    const confirm = screen.getByRole("button", { name: "Delete forever" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Workspace name to confirm" }), "Software");
    await user.click(confirm);

    expect(sent("DELETE", "/workspaces/ws_1")[0]?.body).toEqual({ confirmName: "Software" });
    expect(await screen.findByText("Start a workspace")).toBeInTheDocument();
  });

  it("isn't offered to members", async () => {
    fakeApi.workspace = makeWorkspace({ myRole: "MEMBER" });
    renderApp("/w/ws_1/settings");
    expect(await screen.findByText("Members")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete workspace" })).not.toBeInTheDocument();
  });
});
