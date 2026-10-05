// Create apps/api/.env from the example the first time, without overwriting your edits.
import { copyFileSync, existsSync } from "node:fs";

const target = "apps/api/.env";
if (!existsSync(target)) {
  copyFileSync("apps/api/.env.example", target);
  console.log(`Created ${target} from .env.example`);
}
