# 🚫 KINYARWANDA UI TRANSLATION BLOCKED

**Status**: ✅ IMPLEMENTED (2025-12-08)  
**Severity**: CRITICAL - BLOCKING REQUIREMENT

## Summary

Kinyarwanda (`rw`, `rw-RW`) has been **permanently BLOCKED** from UI/UX translation in the EasyMO platform. The UI must NEVER be translated to Kinyarwanda.

## What Was Changed

### 1. Language Constants Updated

#### File: `supabase/functions/_shared/config/constants.ts`
- **REMOVED** `RW: "rw"` from `LANGUAGES` enum
- **ADDED** `BLOCKED_UI_LANGUAGES = ["rw", "rw-RW"]`
- **ADDED** support for ES, PT, DE (Spanish, Portuguese, German)

```typescript
// BEFORE (WRONG)
export const LANGUAGES = {
  EN: "en",
  FR: "fr",
  RW: "rw",  // ❌ REMOVED
  SW: "sw",
} as const;

// AFTER (CORRECT)
export const LANGUAGES = {
  EN: "en",
  FR: "fr",
  SW: "sw",
  ES: "es",  // ✅ ADDED
  PT: "pt",  // ✅ ADDED
  DE: "de",  // ✅ ADDED
} as const;

export const BLOCKED_UI_LANGUAGES = ["rw", "rw-RW"] as const;
```

### 2. Translator Logic Updated

#### File: `supabase/functions/_shared/i18n/translator.ts`
- **REMOVED** Kinyarwanda locale import
- **ADDED** blocking logic in `t()` function
- **ADDED** warning logs when Kinyarwanda is attempted

```typescript
// Blocks Kinyarwanda and forces fallback to English
if (BLOCKED_UI_LANGUAGES.some(blocked => normalizedLocale === blocked || normalizedLocale.startsWith(blocked + '-'))) {
  console.warn(`[i18n] Blocked UI translation to Kinyarwanda (${locale}). Using ${DEFAULT_LANGUAGE} instead.`);
  locale = DEFAULT_LANGUAGE;
}
```

### 3. Language Detection Blocked

#### File: `supabase/functions/_shared/wa-webhook-shared/i18n/language.ts`
- **UPDATED** `coerceToSupportedLanguage()` to reject Kinyarwanda
- **ADDED** warning logs for blocked language detection

```typescript
// Block Kinyarwanda detection
if (BLOCKED_UI_LANGUAGES.some(blocked => normalized === blocked || normalized.startsWith(blocked.toLowerCase()))) {
  console.warn(`[i18n] Blocked Kinyarwanda language detection: ${candidate}. Returning null to force default.`);
  return null; // Force fallback to default language
}
```

### 4. Multilingual Package Updated

#### File: `packages/ai-core/src/capabilities/multilingual.ts`
- **REMOVED** `'rw'` from `SupportedLanguage` type
- **REMOVED** all Kinyarwanda translations from `loadCommonTranslations()`
- **UPDATED** `detectLanguage()` to default to English when Kinyarwanda detected

```typescript
// BEFORE
export type SupportedLanguage = 'en' | 'fr' | 'rw' | 'sw'; // ❌

// AFTER
export type SupportedLanguage = 'en' | 'fr' | 'sw' | 'es' | 'pt' | 'de'; // ✅

// Language detection now blocks Kinyarwanda
if (lowerText.includes('muraho') || lowerText.includes('murakoze')) {
  log.info('Kinyarwanda detected but blocked for UI. Defaulting to English.');
  return 'en'; // Force to English instead of 'rw'
}
```

### 5. README Updated

#### File: `README.md`
- **ADDED** prominent section at top: "CRITICAL RULE: NO KINYARWANDA UI TRANSLATION"
- **ADDED** clear examples of what NOT to do
- **ADDED** enforcement rules

## Approved UI Languages

The following languages ARE SUPPORTED for UI translation:

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Default |
| `fr` | French | ✅ Supported |
| `sw` | Swahili | ✅ Supported |
| `es` | Spanish | ✅ Supported |
| `pt` | Portuguese | ✅ Supported |
| `de` | German | ✅ Supported |
| `rw` | Kinyarwanda | 🚫 **BLOCKED** |

## How to Verify

### 1. Check Constants
```bash
grep -r "RW.*rw" supabase/functions/_shared/config/constants.ts
# Should return: export const BLOCKED_UI_LANGUAGES = ["rw", "rw-RW"]
```

### 2. Check Language Type
```bash
grep "SupportedLanguage" packages/ai-core/src/capabilities/multilingual.ts
# Should NOT include 'rw' in the type definition
```

### 3. Check Translator
```bash
grep "BLOCKED_UI_LANGUAGES" supabase/functions/_shared/i18n/translator.ts
# Should show blocking logic in t() function
```

### 4. Test in Code
```typescript
import { t } from '@shared/i18n/translator';

// This will now fallback to English with a warning
const translation = t('rw', 'home.title'); // Logs warning, returns English
```

## Files Modified

1. ✅ `README.md` - Added critical rule section
2. ✅ `supabase/functions/_shared/config/constants.ts` - Removed RW, added BLOCKED_UI_LANGUAGES
3. ✅ `supabase/functions/_shared/i18n/translator.ts` - Added blocking logic
4. ✅ `supabase/functions/_shared/wa-webhook-shared/i18n/language.ts` - Blocked detection
5. ✅ `packages/ai-core/src/capabilities/multilingual.ts` - Removed RW type and translations

## Files Deleted

The following Kinyarwanda translation files have been **permanently deleted**:

1. ✅ `client-pwa/messages/rw.json`
2. ✅ `supabase/functions/_shared/i18n/locales/rw.ts`
3. ✅ `supabase/functions/_shared/wa-webhook-shared/i18n/messages/farmer_rw.json`
4. ✅ `supabase/functions/_shared/wa-webhook-shared/i18n/messages/jobs_rw.json`
5. ✅ `supabase/functions/wa-webhook-mobility/i18n/messages/farmer_rw.json`
6. ✅ `supabase/functions/wa-webhook-mobility/i18n/messages/jobs_rw.json`
7. ✅ `supabase/functions/wa-webhook/i18n/messages/farmer_rw.json`
8. ✅ `supabase/functions/wa-webhook/i18n/messages/jobs_rw.json`

**Total: 8 Kinyarwanda translation files deleted**

## Enforcement

### Build-time Checks
The following would be ideal to add:

```typescript
// scripts/assert-no-kinyarwanda-ui.mjs
const forbiddenPatterns = [
  /LANGUAGES.*RW.*"rw"/,
  /SupportedLanguage.*'rw'/,
  /locale.*=.*['"]rw['"]/,
  /translateTo\(['"]rw['"]\)/,
];

// Scan all TS files and fail build if patterns found
```

### Runtime Warnings
When Kinyarwanda is attempted:
```
[i18n] Blocked UI translation to Kinyarwanda (rw). Using en instead.
[i18n] Blocked Kinyarwanda language detection: rw-RW. Returning null to force default.
```

## Why This Rule Exists

1. **Product Decision**: UI translation to Kinyarwanda is not supported by product requirements
2. **User Experience**: Mixing Kinyarwanda UI with other content creates confusion
3. **Maintenance**: Reduces translation maintenance burden
4. **Quality**: Ensures consistent UI language across platform

## Migration Path

If Kinyarwanda support is needed in the future:

1. Remove from `BLOCKED_UI_LANGUAGES`
2. Add back to `SupportedLanguage` types
3. Create complete translations for ALL UI strings
4. Test thoroughly with Kinyarwanda-speaking users
5. Update documentation

**Until then: Kinyarwanda UI translation is BLOCKED.**

## Questions?

- **Q: Can users still write in Kinyarwanda?**
  - A: Yes! This only blocks UI translation. Users can send messages in any language.

- **Q: What if I need to add a new language?**
  - A: Only add `en`, `fr`, `sw`, `es`, `pt`, or `de`. NOT `rw`.

- **Q: What happens if code tries to use 'rw'?**
  - A: It falls back to English with a warning log.

---

**Last Updated**: 2025-12-08  
**Author**: GitHub Copilot CLI  
**Status**: ACTIVE - DO NOT REMOVE THIS BLOCKING REQUIREMENT
