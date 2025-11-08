import { redirect } from "next/navigation";
// import { readSessionFromCookies } from "@/lib/server/session";
import { getAdminRoutePath } from "@/lib/routes";

// TODO: Re-enable authentication later
// Authentication is temporarily disabled - direct access to dashboard
export default async function HomePage() {
  // const session = await readSessionFromCookies();
  // if (!session) {
  //   redirect(getAdminRoutePath("login"));
  // }
  redirect(getAdminRoutePath("panelDashboard"));
}

