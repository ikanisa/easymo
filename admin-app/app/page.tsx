import { redirect } from "next/navigation";
import { getAdminRoutePath } from "@/lib/routes";

export default function HomePage() {
  redirect(getAdminRoutePath("panelDashboard"));
}

