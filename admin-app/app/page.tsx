import { redirect } from "next/navigation";
import { readSessionFromCookies } from "@/lib/server/session";

export default async function HomePage() {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  redirect("/dashboard");
}
