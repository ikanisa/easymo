import { redirect } from "next/navigation";
import { getAdminRoutePath } from "@/lib/routes";

// TODO: Re-enable login authentication later
// Login is temporarily disabled - redirect directly to dashboard
export default async function LoginPage() {
  redirect(getAdminRoutePath("panelDashboard"));
}


