import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { readSessionFromCookies } from "@/lib/server/session";
import { getAdminRoutePath } from "@/lib/routes";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | easyMO Admin",
  description: "Sign in to access the easyMO admin panel",
};

export default async function LoginPage() {
  const session = await readSessionFromCookies();
  if (session) {
    redirect(getAdminRoutePath("panelDashboard"));
  }

  return <LoginForm />;
}

