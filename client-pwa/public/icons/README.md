# PWA Icons

This directory should contain PWA icons in the following sizes:

- icon-192x192.png
- icon-512x512.png

You can generate these using a tool like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

Or use ImageMagick:
```bash
# From a 1024x1024 source image
convert logo.png -resize 192x192 icon-192x192.png
convert logo.png -resize 512x512 icon-512x512.png
```

For now, the PWA will work without icons, but they're required for a complete PWA experience.
