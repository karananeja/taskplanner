import { Briefcase } from "lucide-react";
import { defineModule } from "../define-module";
import { ClientsPage } from "./features/list/clients-page";

export const clientsModule = defineModule({
  id: "clients",
  path: "clients",
  nav: { label: "Clients", icon: Briefcase, order: 60 },
  Screen: ClientsPage,
});
