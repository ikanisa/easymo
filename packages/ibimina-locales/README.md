# @ibimina/locales

Multi-language content packs and translations for country-specific localization.

## Overview

This package provides localized content and translations for SACCO+ across
different countries and languages. Each locale includes USSD instructions, help
content, legal page links, and UI translations.

## Supported Locales

- `rw-RW` - Kinyarwanda (Rwanda)
- `en-RW` - English (Rwanda)
- `fr-RW` - French (Rwanda)
- `fr-SN` - French (Senegal)
- `fr-CI` - French (Côte d'Ivoire)
- `en-GH` - English (Ghana)
- `en-ZM` - English (Zambia)
- More to be added...

## Usage

### Get content pack

```typescript
import { getContentPack } from "@ibimina/locales";

const contentPack = getContentPack("en-RW");

// Access USSD instructions
console.log(contentPack.ussd.providers[0].code); // '*182*8*1#'
console.log(contentPack.ussd.providers[0].instructions); // ['Dial *182*8*1#', ...]

// Access help content
console.log(contentPack.help.paymentGuide);
console.log(contentPack.help.contactInfo.helpline);

// Access legal page URLs
console.log(contentPack.legal.termsUrl);
```

Need resilient fallbacks? Swap to `resolveContentPack` which deep merges with an
English baseline when a locale is partially defined:

```typescript
import { resolveContentPack } from "@ibimina/locales";

const senegal = resolveContentPack("fr-SN");
const ivoryCoast = resolveContentPack("fr-CI", { fallbackLocale: "en-RW" });
```

### Get translations

```typescript
import { getMessages } from "@ibimina/locales";

const messages = getMessages("rw-RW");

// Access UI translations
console.log(messages.common.welcome); // 'Murakaza neza'
console.log(messages.payment.title); // 'Kwishyura'
console.log(messages.member.name); // 'Amazina'
```

For runtime fallbacks, use the helper variants:

```typescript
import { resolveMessages, getMessageDictionary } from "@ibimina/locales";

const merged = resolveMessages("fr-SN");
const dictionary = getMessageDictionary("fr-SN");

console.log(dictionary["common.save"]); // 'Enregistrer'
```

`getMessageDictionary` flattens the translation tree into dot-notation keys that
plug directly into custom lookup hooks.

### Get by country

```typescript
import {
  getContentPackByCountry,
  getLocalesForCountry,
} from "@ibimina/locales";

// Get default content pack for country
const pack = getContentPackByCountry("RWA"); // Returns rw-RW pack

// Get all locales for country
const locales = getLocalesForCountry("RWA"); // ['rw-RW', 'en-RW', 'fr-RW']
```

### List available locales

```typescript
import { getAvailableLocales } from "@ibimina/locales";

const locales = getAvailableLocales(); // ['rw-RW', 'en-RW', 'fr-SN', ...]
```

## Content Pack Structure

### CountryContentPack

```typescript
interface CountryContentPack {
  locale: LocaleCode; // 'en-GH'
  countryISO3: string; // 'GHA'
  countryName: string; // 'Ghana'

  // USSD payment instructions
  ussd: {
    providers: Array<{
      name: string; // 'MTN Mobile Money'
      code: string; // '*170#'
      instructions: string[]; // Step-by-step guide
    }>;
    generalInstructions: string[];
  };

  // Legal page URLs
  legal: {
    termsUrl: string;
    privacyUrl: string;
    cookiesUrl?: string;
  };

  // Help content
  help: {
    paymentGuide: string[];
    troubleshooting: string[];
    contactInfo: {
      helpline?: string;
      email?: string;
      hours?: string;
    };
  };

  // Market-specific tips
  tips?: {
    dualSim?: string[];
    networkIssues?: string[];
    marketDays?: string[];
  };
}
```

### TranslationMessages

```typescript
interface TranslationMessages {
  common: {
    welcome: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    loading: string;
    error: string;
    success: string;
  };

  payment: {
    title: string;
    amount: string;
    reference: string;
    confirmPayment: string;
    paymentSuccess: string;
    paymentFailed: string;
  };

  member: {
    title: string;
    name: string;
    phone: string;
    memberCode: string;
    joinDate: string;
  };

  group: {
    title: string;
    groupName: string;
    groupCode: string;
    members: string;
    totalSavings: string;
  };
}
```

## Adding a New Locale

### 1. Create locale file

Create `src/locales/{locale-code}.ts`:

```typescript
import type {
  CountryContentPack,
  TranslationMessages,
} from "../types/index.js";

export const enGHContentPack: CountryContentPack = {
  locale: "en-GH",
  countryISO3: "GHA",
  countryName: "Ghana",

  ussd: {
    providers: [
      {
        name: "MTN Mobile Money",
        code: "*170#",
        instructions: [
          "Dial *170#",
          'Select "Pay Bills"',
          "Enter merchant code",
          "Enter reference number: GHA.ACC.XXX.YYYY.001",
          "Enter amount in GHS",
          "Confirm with PIN",
        ],
      },
      // Add more providers...
    ],
    generalInstructions: [
      "Use the exact reference number from your card",
      "Double-check the amount before confirming",
      "Keep the confirmation SMS as proof",
    ],
  },

  legal: {
    termsUrl: "/legal/terms?country=gh&lang=en",
    privacyUrl: "/legal/privacy?country=gh&lang=en",
  },

  help: {
    paymentGuide: [
      "Ensure you have sufficient balance",
      "Use reference number exactly as shown",
      "Contact your institution if issues arise",
    ],
    troubleshooting: [
      "If USSD fails: Try from a different location",
      "If payment is rejected: Check the reference number",
      "If no SMS: Check transaction history via *170#",
    ],
    contactInfo: {
      helpline: "+233 XX XXX XXXX",
      email: "support@sacco-plus.gh",
      hours: "Monday - Friday, 8:00 AM - 5:00 PM",
    },
  },

  tips: {
    dualSim: [
      "If you have dual SIM, use the one with mobile money",
      "Ensure the SIM has sufficient balance",
    ],
    networkIssues: [
      "Try from a location with better coverage",
      "Wait a few minutes and retry",
    ],
    marketDays: ["Market day is Saturday", "Pay early to avoid queues"],
  },
};

export const enGHMessages: TranslationMessages = {
  common: {
    welcome: "Welcome",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    loading: "Loading...",
    error: "Error",
    success: "Success",
  },

  payment: {
    title: "Payment",
    amount: "Amount",
    reference: "Reference Number",
    confirmPayment: "Confirm Payment",
    paymentSuccess: "Payment successful",
    paymentFailed: "Payment failed",
  },

  member: {
    title: "Member",
    name: "Name",
    phone: "Phone",
    memberCode: "Member Code",
    joinDate: "Join Date",
  },

  group: {
    title: "Group",
    groupName: "Group Name",
    groupCode: "Group Code",
    members: "Members",
    totalSavings: "Total Savings",
  },
};
```

## Translation workflow

Refer to the
[Translation Pipeline guide](../../docs/localization/translation-pipeline.md)
for string harvesting, Phrase synchronization, and QA validation steps that keep
locale packs production ready.

### 2. Export from index

Update `src/index.ts`:

```typescript
// Add imports
export { enGHContentPack, enGHMessages } from "./locales/en-GH.js";

// Add to registries
import { enGHContentPack, enGHMessages } from "./locales/en-GH.js";

export const contentPacks: Record<string, CountryContentPack> = {
  // ... existing
  "en-GH": enGHContentPack,
};

export const messages: Record<string, TranslationMessages> = {
  // ... existing
  "en-GH": enGHMessages,
};
```

### 3. Update types (if needed)

If adding a new locale code, update `src/types/index.ts`:

```typescript
export type LocaleCode =
  | "rw-RW"
  | "en-RW"
  | "fr-RW"
  | "fr-SN"
  | "fr-CI"
  | "en-GH"; // Add new locale
// ...
```

## Translation Guidelines

### 1. Be Specific to Context

Translations should match the local context:

- Use local currency names (not symbols)
- Use local provider names
- Use local terminology for financial concepts

### 2. USSD Instructions

- Include exact USSD codes
- Use imperative voice ("Dial", "Select", "Enter")
- Be step-by-step
- Mention the reference token format

### 3. Help Content

- Anticipate common issues
- Provide actionable solutions
- Include contact information
- Be reassuring but clear

### 4. Legal Compliance

- Link to localized legal documents
- Ensure translations reviewed by local legal team
- Update when regulations change

### 5. Tone

- Formal but friendly
- Clear and direct
- Avoid idioms that don't translate
- Use simple sentences

## Using in Apps

### Next.js App

```typescript
import { getContentPack, getMessages } from '@ibimina/locales';

export default function PaymentPage({ params }: { params: { locale: string } }) {
  const contentPack = getContentPack(params.locale as LocaleCode);
  const messages = getMessages(params.locale as LocaleCode);

  return (
    <div>
      <h1>{messages.payment.title}</h1>

      <section>
        <h2>USSD Instructions</h2>
        {contentPack.ussd.providers.map(provider => (
          <div key={provider.name}>
            <h3>{provider.name} - {provider.code}</h3>
            <ol>
              {provider.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section>
        <h2>Need Help?</h2>
        <p>Call: {contentPack.help.contactInfo.helpline}</p>
        <p>Email: {contentPack.help.contactInfo.email}</p>
      </section>
    </div>
  );
}
```

### React Component

```typescript
import { getMessages } from '@ibimina/locales';

function PaymentForm({ locale }: { locale: string }) {
  const t = getMessages(locale as LocaleCode);

  return (
    <form>
      <label>{t.payment.amount}</label>
      <input type="number" />

      <label>{t.payment.reference}</label>
      <input type="text" />

      <button>{t.payment.confirmPayment}</button>
    </form>
  );
}
```

## Development

### Install dependencies

```bash
pnpm install
```

### Type check

```bash
pnpm typecheck
```

## Related

- [Multi-Country Architecture](../../docs/MULTI_COUNTRY_ARCHITECTURE.md)
- [Add Country Playbook](../../docs/ADD_COUNTRY_PLAYBOOK.md)
- [@ibimina/providers](../providers/README.md) - Provider adapters

## License

Private - Ibimina SACCO+ Platform
