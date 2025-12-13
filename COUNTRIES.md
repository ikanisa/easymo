# Supported Countries

**Last Updated**: 2025-12-13

## Official Supported Countries

EasyMO operates **exclusively in Rwanda**:

| Code | Country | Capital | Currency | Status |
|------|---------|---------|----------|--------|
| **RW** | 🇷🇼 Rwanda | Kigali | RWF (Rwandan Franc) | ✅ Active |

## Deprecated/Removed Countries

The following countries are **NOT supported** and should **NEVER** be used in code:

| Code | Country | Reason | Date Removed |
|------|---------|--------|--------------|
| ~~KE~~ | ~~Kenya~~ | Not in operational scope | 2025-11-27 |
| ~~UG~~ | ~~Uganda~~ | Not in operational scope | 2025-11-27 |
| ~~CD~~ | ~~DRC~~ | Not in operational scope | 2025-12-13 |
| ~~BI~~ | ~~Burundi~~ | Not in operational scope | 2025-12-13 |
| ~~TZ~~ | ~~Tanzania~~ | Not in operational scope | 2025-12-13 |

## Default Country

**RW (Rwanda)** is the only supported country.

## Country Code Usage

### ✅ Correct Usage

```typescript
// TypeScript
const supportedCountries = ['RW'];
const defaultCountry = 'RW';

// SQL
available_countries ARRAY['RW']
DEFAULT 'RW'
```

### ❌ Incorrect Usage (DO NOT USE)

```typescript
// WRONG - Do not include any country other than RW
const countries = ['RW', 'CD', 'BI', 'TZ']; // ❌ NO!
```

## Feature Availability

### Mobile Money (MoMo)
- ✅ **RW**: MTN Mobile Money, Airtel Money

### Vehicle Insurance
- ✅ **RW**: Full support

### Languages

| Country | Primary Language | Secondary | Tertiary |
|---------|-----------------|-----------|----------|
| **RW** | Kinyarwanda (rw) | French (fr) | English (en) |

## Code Compliance

All code MUST only use Rwanda: **RW**

### Automated Checks

Run before commit:
```bash
# Check for non-RW country references
grep -r "KE\|UG\|CD\|BI\|TZ\|Kenya\|Uganda\|Congo\|Burundi\|Tanzania" supabase/ --exclude-dir=node_modules

# Should return NO results
```

### Migration Validation

All new migrations must use only Rwanda:
```sql
-- ✅ CORRECT
DEFAULT ARRAY['RW']

-- ❌ WRONG  
DEFAULT ARRAY['RW', 'CD', 'BI', 'TZ'] -- NO!
```

---

**Remember**: Only **RW (Rwanda)** is supported.
