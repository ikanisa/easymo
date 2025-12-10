# @easymo/locales

Internationalization (i18n) translations for the EasyMO platform.

## Supported Locales

- **en** - English
- **fr** - French
- **rw** - Kinyarwanda

## Usage

```typescript
import { t, getTranslations, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@easymo/locales';

// Get a translation
const saveLabel = t('common.save', 'rw'); // "Bika"

// Get all translations for a locale
const translations = getTranslations('fr');
```

## Translation Files

Translation files are located in `src/translations/`:
- `en.json` - English translations
- `fr.json` - French translations
- `rw.json` - Kinyarwanda translations

## Namespaces

- **common** - Common UI elements (save, cancel, etc.)
- **vendor** - Vendor portal specific translations
- **admin** - Admin panel translations
- **errors** - Error messages

## Merger Note

This package will receive additional translations from the Ibimina repository merger.
See `docs/MERGER_PLAN.md` for details.
