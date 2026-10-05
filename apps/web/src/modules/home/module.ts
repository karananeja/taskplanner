import { House } from "lucide-react";
import { defineModule } from "../define-module";
import { HomePage } from "./features/dashboard/home-page";

export const homeModule = defineModule({
  id: "home",
  path: "home",
  nav: { label: "Home", icon: House, order: 10 },
  Screen: HomePage,
});
