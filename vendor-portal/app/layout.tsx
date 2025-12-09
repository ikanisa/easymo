import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
import { headers, cookies } from "next/headers";
import { resolveRequestLocale } from "@/lib/i18n/resolve-locale";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ibimina.local";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ibimina Staff Console",
    template: "%s · Ibimina Staff Console",
  },
  applicationName: "Ibimina Staff Console",
  description: "Staff-only platform for Umurenge SACCO Ibimina operations.",
  keywords: ["SACCO", "Ibimina", "PWA", "Finance", "Rwanda"],
  // Use Next metadata manifest output
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ibimina Staff Console",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

type StoredTheme = "light" | "dark" | "nyungwe";

function readThemeCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): StoredTheme {
  const themeCookie = cookieStore.get("theme")?.value as StoredTheme | undefined;
  if (themeCookie === "dark" || themeCookie === "nyungwe") {
    return themeCookie;
  }
  return "light";
}

function resolveColorScheme(theme: StoredTheme): "light" | "dark" {
  return theme === "light" ? "light" : "dark";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const cookieStore = await cookies();
  const nonce = headerList.get("x-csp-nonce") ?? undefined;
  const locale = resolveRequestLocale({ headers: headerList, cookies: cookieStore });
  const storedTheme = readThemeCookie(cookieStore);
  const colorScheme = resolveColorScheme(storedTheme);

  // Map "dark" to "nyungwe" for AppProviders since "dark" is not a valid theme option
  // Only "light" and "nyungwe" are valid forcedTheme values
  const forcedTheme: "light" | "nyungwe" | undefined =
    storedTheme === "dark" ? "nyungwe" : storedTheme === "light" ? "light" : "nyungwe";

  const htmlClass = `${storedTheme} theme-${colorScheme}`;
  const baseBodyClass =
    colorScheme === "dark"
      ? "antialiased bg-[color:var(--color-canvas,#05080f)] text-[color:var(--color-foreground,#f5f7fb)]"
      : "antialiased bg-[color:var(--color-canvas,#ffffff)] text-[color:var(--color-foreground,#111827)]";
  const fallbackBodyClass =
    storedTheme === "nyungwe" ? "bg-nyungwe text-neutral-0" : "bg-white text-gray-900";
  const rootClass = `${baseBodyClass} ${fallbackBodyClass} transition-colors duration-300`;

  return (
    <html
      lang={locale}
      data-theme={colorScheme}
      data-scroll-behavior="smooth"
      className={htmlClass}
      style={{ colorScheme }}
      suppressHydrationWarning
    >
      <body className={rootClass}>
        <AppProviders nonce={nonce} locale={locale} forcedTheme={forcedTheme}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
