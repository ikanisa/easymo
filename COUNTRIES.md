# Supported Countries

**Last Updated**: 2025-11-27

## Official Supported Countries

EasyMO operates in the following countries:

| Code | Country | Capital | Currency | Status |
|------|---------|---------|----------|--------|
| **RW** | 🇷🇼 Rwanda | Kigali | RWF (Rwandan Franc) | ✅ Primary Market |
| **CD** | 🇨🇩 Democratic Republic of Congo | Kinshasa | CDF (Congolese Franc) | ✅ Active |
| **BI** | 🇧🇮 Burundi | Gitega | BIF (Burundian Franc) | ✅ Active |
| **TZ** | 🇹🇿 Tanzania | Dodoma | TZS (Tanzanian Shilling) | ✅ Active |

## Deprecated/Removed Countries

The following countries are **NOT supported** and should **NEVER** be used in code:

| Code | Country | Reason | Date Removed |
|------|---------|--------|--------------|
| ~~KE~~ | ~~Kenya~~ | Not in operational scope | 2025-11-27 |
| ~~UG~~ | ~~Uganda~~ | Not in operational scope | 2025-11-27 |

## Default Country

**RW (Rwanda)** is the default country for all operations when country cannot be determined.

## Country Code Usage

### ✅ Correct Usage

```typescript
// TypeScript
const supportedCountries = ['RW', 'CD', 'BI', 'TZ'];
const defaultCountry = 'RW';

// SQL
available_countries ARRAY['RW', 'CD', 'BI', 'TZ']
DEFAULT 'RW'
```

### ❌ Incorrect Usage (DO NOT USE)

```typescript
// WRONG - Do not include KE or UG
const countries = ['RW', 'KE', 'UG', 'TZ']; // ❌ NO!

// WRONG
available_countries ARRAY['RW', 'KE', 'TZ', 'UG'] // ❌ NO!
```

## Feature Availability by Country

### Mobile Money (MoMo)
- ✅ **RW**: MTN Mobile Money, Airtel Money
- ✅ **TZ**: Vodacom M-Pesa, Airtel Money, Tigo Pesa
- ⚠️ **CD, BI**: Limited support (development)

### Vehicle Insurance
- ✅ **RW**: Full support
- ✅ **TZ**: Active
- ⏳ **CD, BI**: Planned

### Languages by Country

| Country | Primary Language | Secondary | Tertiary |
|---------|-----------------|-----------|----------|
| **RW** | Kinyarwanda (rw) | French (fr) | English (en) |
| **CD** | French (fr) | Lingala | Swahili (sw) |
| **BI** | Kirundi | French (fr) | Swahili (sw) |
| **TZ** | Swahili (sw) | English (en) | - |

## Adding New Countries

**IMPORTANT**: Before adding support for a new country, ensure:

1. ✅ Business approval obtained
2. ✅ Payment gateway integration ready
3. ✅ Regulatory compliance verified
4. ✅ Translations prepared
5. ✅ Local partnerships established

### Steps to Add a Country

1. **Update Database**:
```sql
-- Add to profile_menu_items
UPDATE profile_menu_items 
SET available_countries = array_append(available_countries, 'XX')
WHERE item_key = 'feature_name';
```

2. **Update Code Constants**:
```typescript
// Update supported countries list
const SUPPORTED_COUNTRIES = ['RW', 'CD', 'BI', 'TZ', 'XX'];
```

3. **Add Translations**: Update all translation files for the new country

4. **Update Documentation**: Add to this file

## Regional Groupings

### East African Community (EAC) Countries
- 🇷🇼 RW (Rwanda) - Member
- 🇹🇿 TZ (Tanzania) - Member  
- 🇧🇮 BI (Burundi) - Member
- 🇨🇩 CD (DRC) - Observer (not full member)

### Payment Integration Priority
1. **Tier 1**: RW (most mature)
2. **Tier 2**: TZ (growing)
3. **Tier 3**: BI, CD (developing)

## Code Compliance

All code MUST only use the 4 supported countries: **RW, CD, BI, TZ**

### Automated Checks

Run before commit:
```bash
# Check for KE/UG references
grep -r "KE\|UG\|Kenya\|Uganda" supabase/ --exclude-dir=node_modules

# Should return NO results
```

### Migration Validation

All new migrations must use only supported countries:
```sql
-- ✅ CORRECT
DEFAULT ARRAY['RW', 'CD', 'BI', 'TZ']

-- ❌ WRONG  
DEFAULT ARRAY['RW', 'KE', 'UG', 'TZ'] -- NO!
```

## Contact

For questions about country support, contact:
- **Product**: Country expansion roadmap
- **Engineering**: Technical implementation
- **Compliance**: Regulatory requirements

---

**Remember**: Only RW, CD, BI, TZ are supported. **NEVER** use KE or UG.
