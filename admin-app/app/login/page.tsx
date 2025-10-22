import { redirect } from "next/navigation";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { LoginForm } from "@/components/auth/LoginForm";
import { readSessionFromCookies } from "@/lib/server/session";
import { getAdminRoutePath } from "@/lib/routes";

export default async function LoginPage() {
  const session = await readSessionFromCookies();
  if (session) {
    redirect(getAdminRoutePath("panelDashboard"));
  }

  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging";

  return (
    <GradientBackground
      variant="surface"
      className="flex min-h-screen items-center justify-center bg-[color:var(--color-background)] px-4 py-10"
    >
      <LoginForm environmentLabel={environmentLabel} />
    </GradientBackground>
  );
}
