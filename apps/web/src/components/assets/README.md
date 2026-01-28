# Moltbot Marketplace Asset Library

This directory contains the React components and hooks for the Moltbot Marketplace design system.

## Components

- **Logos**: `MoltbotLogo`, `MoltbotIcon`, `MoltbotWordmark`
- **Illustrations**: `NoListingsIllustration`, `NoMatchesIllustration`, `ConnectionErrorIllustration`
- **Decorative**: `Sparkles`, `Confetti`, `GradientMesh`
- **Badges**: `VerifiedBadge`, `HotBadge`, `NewBadge`
- **Loading**: `SkeletonCard`, `Spinner`

## Public Assets

Standalone SVG files are located in `/public/assets/`. You can use these for:
- Favicons
- Open Graph images
- Marketing materials

## Generating App Icons (PWA)

To generate the required PWA icons from the logo, run the following commands (requires ImageMagick):

```bash
# Ensure you are in the project root
mkdir -p apps/web/public/assets/icons

# Generate icons
convert apps/web/public/assets/logos/moltbot-logo.svg -resize 192x192 apps/web/public/assets/icons/icon-192.png
convert apps/web/public/assets/logos/moltbot-logo.svg -resize 512x512 apps/web/public/assets/icons/icon-512.png
convert apps/web/public/assets/logos/moltbot-logo.svg -resize 180x180 apps/web/public/assets/icons/apple-touch-icon.png
```

## Colors

Colors are defined in `src/styles/tokens.json` and are available via CSS variables (if configured) or direct usage.
