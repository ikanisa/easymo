# @ibimina/ui

This package hosts the shared Atlas UI components and design tokens used across
ibimina applications.

## Tailwind tokens

Design tokens are published in `tokens.json` at the root of this package. They
mirror the core values used by the client and marketing sites (colors,
typography, spacing, motion, and breakpoints).

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";
import tokens from "@ibimina/ui/tokens.json" assert { type: "json" };

const config: Config = {
  theme: {
    screens: tokens.screens,
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      // ...
    },
  },
};

export default config;
```

### Do / Don’t

**Do**

- Reuse `tokens.json` instead of duplicating values between apps.
- Keep tokens neutral: they should describe primitives (colors, spacing,
  typography) rather than component-specific styles.
- Add new tokens with documentation so downstream apps can adopt them
  consistently.

**Don’t**

- Hardcode hex values or spacing steps in app-level Tailwind configs when a
  token exists.
- Override shared tokens locally unless there is a documented design exception.
- Add component-specific values (e.g., card backgrounds) to the token file—place
  them next to the component instead.
