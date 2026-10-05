import { CalendarDays } from "lucide-react";
import { defineModule } from "../define-module";
import { CalendarPage } from "./features/month/calendar-page";

export const calendarModule = defineModule({
  id: "calendar",
  path: "calendar",
  nav: { label: "Calendar", icon: CalendarDays, order: 40 },
  Screen: CalendarPage,
});
