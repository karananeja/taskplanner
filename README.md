# Tasks — a multi-user task planner

A Kanban task planner for teams: workspaces with invite codes, a six-column board with drag and drop,
a task panel with owners, assignees, subtasks, a checklist, comments with @mentions and full history,
and an approval flow where non-owners' edits go to the task's owners as change requests. Around the board:
a Home dashboard, an Inbox of notifications, a month Calendar of due dates, Docs (written or uploaded),
a Clients page, and Quick Capture, which turns pasted notes into tasks.

Everything runs locally: an Express + Prisma API on SQLite, and a React app served by Vite.

## Run it

You need **Node 20.19 or newer**.

```bash
npm install
npm run setup     # creates apps/api/.env if missing, the SQLite database, and demo data
npm run dev       # API on :4000, web app on http://localhost:3000
```

Open http://localhost:3000 and sign in with a demo account (password `password123` for all):

| Email                                                   | Role            |
| ------------------------------------------------------- | --------------- |
| karan@example.com                                       | Workspace owner |
| jay@example.com, chirag@example.com, joseph@example.com | Members         |

Try it with two browsers (or a private window): sign in as Karan in one and Jay in the other. Edit a task
Jay doesn't own as Jay and it becomes a change request that Karan approves from the task panel. The board
refreshes every 20 seconds, and immediately when you return to the tab.

To start with an empty database instead, run `npm run db:migrate -w @tp/api` without the seed. After changing
`prisma/schema.prisma`, create a new migration with `cd apps/api && npx prisma migrate dev --name <change>`.

### Google sign-in (optional)

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add `http://localhost:3000/api/auth/google/callback` as an authorised redirect URI.
3. Put the client ID and secret in `apps/api/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart.

The "Continue with Google" button only appears when both are set in `apps/api/.env` (not `.env.example`),
and only after the API restarts. Signing in with Google links to an existing account with the same verified email.

### Other commands

```bash
npm run typecheck               # all packages
npm run db:studio -w @tp/api    # browse the database
```

## Testing

```bash
npm test                  # unit + integration tests for every package (about 40 s)
npm run test:coverage     # the same, with coverage reports in each package's coverage/ folder
npm run test:e2e          # end-to-end tests in a real browser (about 2 min)
npm run test:e2e:ui       # the same, in Playwright's interactive UI
npm run test:all          # everything
```

The first time you run end-to-end tests, install the browser once: `npx playwright install chromium`.

If `prisma db push` refuses to run (Prisma blocks it when an AI coding agent runs it), build the throwaway test
databases from SQL instead:
`npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /tmp/schema.sql` in `apps/api`,
then run the tests with `TEST_SCHEMA_SQL=/tmp/schema.sql`.

To work on one area, run its tests in watch mode, e.g. `npm run test:watch -w @tp/web`, or a single file with
`npm test -w @tp/web -- src/modules/tasks`.

| Layer                 | Tools                                    | Where                                | What it covers                                                                                                                                                                    |
| --------------------- | ---------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration       | Vitest + Supertest                       | `apps/api/test/integration`          | Real HTTP requests against the Express app and a fresh SQLite database: auth, workspace isolation, every permission rule, change requests, conflicts, ordering, comments, history |
| API unit              | Vitest                                   | `apps/api/test/unit`                 | Pure logic: field diffs, permissions, password hashing, validation                                                                                                                |
| Shared, query, stores | Vitest                                   | `packages/*/test`                    | Ordering keys and schemas; query caching, polling and optimistic writes; store behaviour like snap-back on a rejected drag                                                        |
| Web                   | Vitest + Testing Library + MSW, in jsdom | `src/**/*.test.tsx` next to the code | Screens driven like a user would: sign-in, routing, board columns and filters, quick add, the task panel's save bar, approvals, conflicts, @mentions                              |
| End-to-end            | Playwright                               | `e2e/`                               | The real API and web app together, including drag and drop and two people approving each other's changes                                                                          |

**How the web tests work.** They mount real screens with the real stores, query cache and axios transport. MSW
answers the HTTP calls with a small in-memory fake API (`src/test/server.ts`), so tests arrange data with
`fakeApi.tasks = [makeTask(...)]` and check what was sent with `sent("PATCH", "/tasks/t_1")`. Any request the fake
doesn't handle fails the test. Every test starts from a clean store, cache and fake API.

**How the end-to-end tests work.** Playwright starts its own API on port 4100 and web app on port 5174, against a
freshly seeded `apps/api/e2e.db`, so it runs fine alongside `npm run dev` and never touches your data. Tests sign
in once as the demo users, run one at a time, and use unique task titles. On failure, open the report with
`npx playwright show-report`; it includes a screenshot and a step-by-step trace.

**Coverage gates.** `npm run test:coverage` fails if the API drops below 85% of lines or the web app below 70%.
The API tests use a cheaper password-hashing cost (only when `NODE_ENV=test`) to stay fast.

## How permissions work

| Action                                                                   | Who can do it directly                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Edit any field                                                           | The task's owners, and the workspace owner (who acts as an owner on every task) |
| Change status, including dragging between columns                        | Owners and assignees                                                            |
| Tick, add or remove checklist items                                      | Owners and assignees                                                            |
| Reorder cards within a column                                            | Any member                                                                      |
| Comment, mention, create tasks and subtasks                              | Any member (the creator becomes an owner)                                       |
| Delete a task                                                            | Owners                                                                          |
| Rename workspace, new invite code, remove members, delete labels/clients | Workspace owner                                                                 |
| Delete the workspace (type its name to confirm)                          | Workspace owner                                                                 |
| Write, upload and edit docs                                              | Any member; deleting a doc is its author or the workspace owner                 |

Anything else a member changes, from the form or by dragging, becomes a **change request**. Owners see it at
the top of the task with a before → after diff and can approve or reject it with a reason; the requester can
withdraw it. A task always keeps at least one owner.

If two people edit the same task, the second save gets a conflict instead of silently overwriting. The panel
then offers **Keep my edits** (reapply only the fields you changed on top of theirs) or **Load their version**.

Assignments, mentions, change requests and their decisions land in each person's Inbox. Everyone can mute
types of notification per workspace from **Notification settings** there.

## Architecture

```
apps/
  api/            Express 5 + Prisma 7 (SQLite via better-sqlite3)
  web/            React 19 + Vite + Tailwind 4 + shadcn-style components
packages/
  shared/         Zod schemas, constants and API types used by both sides
  query/          @tp/query — observable query cache (our @fms/query equivalent)
  data-stores/    @tp/data-stores — class-based domain stores (our @fms/data-stores equivalent)
```

The web app follows the fms-code-flow pattern:

- **Server state lives outside React.** `AuthStore`, `WorkspaceStore` and `TaskStore` own every fetch, cache,
  poll, optimistic update and invalidation. They get an injected `StoreHttp` (axios) and a shared `QueryClient`.
- **One composition root.** `apps/web/src/store/global-store.ts` builds the query client and the stores once.
- **Narrow subscriptions.** Components subscribe with `useQuery` (built on `useSyncExternalStore`) through
  small hooks in `src/hooks`, and derive what they show in render, e.g. filtered board columns.
- **Local state only for the ephemeral.** Drag previews, open menus and form drafts (React Hook Form + Zod) stay
  in components; UI-only shared state (theme, board filters) is in Zustand. No React Context as a data bus, and
  no fetching in `useEffect`.
- **Modules.** Each area is `src/modules/<area>/module.ts` plus `features/<screen>/{page, components, hooks}`.
  The router and sidebar are generated from the registered modules. Nav labels live in each module because
  there's no feature-flag API yet.

On the API, every workspace route checks membership first and returns 404 to non-members, so ids can't be
probed. Sessions are random tokens stored hashed, in an httpOnly SameSite cookie; passwords use scrypt;
state-changing requests must come from the app's own origin as JSON; sign-in and invite codes are rate-limited.

Uploaded files (up to 5 MB) are stored in the database and always served as downloads, never rendered inline.

## Not built yet

File attachments on tasks, rich-text formatting in docs, and real-time updates over WebSockets (polling covers
it for now). Switching to Postgres later means changing the datasource provider and adapter;
the schema avoids SQLite-only features.
