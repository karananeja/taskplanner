import { Route, Routes } from "react-router";
import { DocEditorPage } from "./editor/doc-editor-page";
import { DocsListPage } from "./list/docs-list-page";

export function DocsScreen() {
  return (
    <Routes>
      <Route index element={<DocsListPage />} />
      <Route path=":docId" element={<DocEditorPage />} />
    </Routes>
  );
}
