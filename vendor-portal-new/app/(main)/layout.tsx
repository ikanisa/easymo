import { requireUserAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileProvider } from "@/providers/profile-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await requireUserAndProfile();

  // Enforce first-login password reset if flagged in user metadata
  const needsReset = Boolean(
    (auth.user.user_metadata as Record<string, unknown> | null)?.pw_reset_required
  );
  if (needsReset) {
    // Redirect to the first-login reset screen in auth flow
    // Note: this layout only wraps (main) routes, so /auth/* remains reachable
    redirect("/auth/first-login");
  }

  return (
    <ProfileProvider value={auth}>
      <AppShell profile={auth.profile}>{children}</AppShell>
    </ProfileProvider>
  );
}
