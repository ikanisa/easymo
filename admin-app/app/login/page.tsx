import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { readSessionFromCookies } from "@/lib/server/session";
import { getAdminRoutePath } from "@/lib/routes";

export default async function LoginPage() {
  const session = await readSessionFromCookies();
  if (session) {
    redirect(getAdminRoutePath("panelDashboard"));
  }

  return <LoginForm />;
}


