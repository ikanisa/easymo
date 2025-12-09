"use server";

import { cookies } from "next/headers";
import { resolveTheme } from "../../../../../src/design/theme";

type ThemeChoice = "light" | "dark" | "high-contrast" | "nyungwe";

export async function setTheme(theme: ThemeChoice) {
  const cookieStore = await cookies();
  const resolved = resolveTheme(theme);
  const storedTheme: ThemeChoice = theme === "nyungwe" ? "nyungwe" : resolved;
  cookieStore.set("theme", storedTheme, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
