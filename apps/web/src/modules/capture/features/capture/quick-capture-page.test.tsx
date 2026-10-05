import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test/render";
import { fakeApi, sent } from "@/test/server";

describe("quick capture", () => {
  it("splits notes into drafts and creates the ones you keep", async () => {
    const { user } = renderApp("/w/ws_1/capture");
    await user.type(await screen.findByRole("textbox", { name: "Notes to split into tasks" }), "Action items:{enter}- Send mockups @Jay Shrivastava{enter}- Call legal{enter}- Skip me");
    await user.click(screen.getByRole("button", { name: "Split into tasks" }));

    expect(await screen.findByText("3 draft tasks")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Include “Skip me”" }));
    await user.click(screen.getByRole("button", { name: "Create 2 tasks" }));

    const created = sent("POST", "/workspaces/ws_1/tasks").map((r) => r.body as { title: string; assigneeIds: string[] });
    expect(created.map((c) => c.title)).toEqual(["Send mockups", "Call legal"]);
    expect(created[0]?.assigneeIds).toEqual(["u_jay"]);
    expect(await screen.findByText("Created 2 tasks")).toBeInTheDocument();
    expect(fakeApi.tasks).toHaveLength(2);
  });
});
