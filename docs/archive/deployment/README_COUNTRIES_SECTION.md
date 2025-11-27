
## Supported Countries

**IMPORTANT**: EasyMO operates in exactly **4 countries**. Do **NOT** use any other country codes.

### ✅ Supported Countries
- 🇷🇼 **RW** - Rwanda (Primary market, default)
- 🇨🇩 **CD** - Democratic Republic of Congo
- 🇧🇮 **BI** - Burundi  
- 🇹🇿 **TZ** - Tanzania

### ❌ NOT Supported (DO NOT USE)
- ~~KE~~ (Kenya) - Removed 2025-11-27
- ~~UG~~ (Uganda) - Removed 2025-11-27

**Default Country**: `RW` (Rwanda)

See [COUNTRIES.md](./COUNTRIES.md) for complete country documentation, feature availability, and compliance guidelines.

### Code Usage
```typescript
// ✅ CORRECT
const SUPPORTED_COUNTRIES = ['RW', 'CD', 'BI', 'TZ'];

// ❌ WRONG - NEVER USE
const countries = ['RW', 'KE', 'UG']; // NO!
```

**All database migrations, TypeScript code, and configuration must only use: RW, CD, BI, TZ**

