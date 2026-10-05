import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

/** One fresh database per test run. Test files create their own users, so they don't collide. */
export default function setup() {
  execFileSync("node", ["scripts/reset-db.mjs", "test.db"], { stdio: "inherit" });
  return () => {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`test.db${suffix}`, { force: true });
  };
}
