import { calendarModule } from "./calendar/module";
import { captureModule } from "./capture/module";
import { clientsModule } from "./clients/module";
import type { AppModule } from "./define-module";
import { docsModule } from "./docs/module";
import { homeModule } from "./home/module";
import { inboxModule } from "./inbox/module";
import { settingsModule } from "./settings/module";
import { tasksModule } from "./tasks/module";

export const modules: AppModule[] = [
  homeModule,
  inboxModule,
  tasksModule,
  calendarModule,
  docsModule,
  clientsModule,
  captureModule,
  settingsModule,
].sort((a, b) => a.nav.order - b.nav.order);
export const defaultModule = homeModule;
