"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { nextThemeValueMap } from "../lib/theme";

type ForcedTheme = keyof typeof nextThemeValueMap;

interface ThemeProviderProps {
  children: React.ReactNode;
  nonce?: string;
  forcedTheme?: ForcedTheme;
}

const themes = Object.keys(nextThemeValueMap) as ForcedTheme[];

export function ThemeProvider({ children, nonce, forcedTheme }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      themes={themes}
      value={nextThemeValueMap}
      forcedTheme={forcedTheme}
      enableSystem={false}
      enableColorScheme={false}
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
