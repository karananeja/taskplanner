import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test/render";
import { fakeApi, sent } from "@/test/server";

describe("docs", () => {
  it("creates a doc, edits it and saves", async () => {
    const { user } = renderApp("/w/ws_1/docs");
    expect(await screen.findByText(/No docs yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New doc" }));

    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Kickoff notes");
    await user.type(screen.getByRole("textbox", { name: "Doc content" }), "Agenda");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(sent("PATCH", "/docs/d_1")[0]?.body).toEqual({ title: "Kickoff notes", body: "Agenda" });
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
    expect(fakeApi.docs[0]?.title).toBe("Kickoff notes");
  });
});
