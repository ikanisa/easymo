import { requireUserAndProfile } from "@/lib/auth";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const { user } = await requireUserAndProfile();

  return <ProfileClient email={user.email ?? ""} />;
}
