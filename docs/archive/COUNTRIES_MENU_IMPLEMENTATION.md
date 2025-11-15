# Countries & Country-Specific WhatsApp Menu - Implementation Summary

## ✅ Completed Successfully

### Overview
Created comprehensive countries table with mobile money details and implemented country-specific WhatsApp menu naming system. Users in different countries now see localized menu item names (e.g., "MOMO QR Code" in Rwanda, "Orange Money QR" in Ivory Coast).

---

## 🌍 Countries Table

### Created: 31 African Countries
- **East Africa** (5): Rwanda, Uganda, Kenya, Tanzania, Burundi
- **Central Africa** (7): Cameroon, DR Congo, Congo, Gabon, CAR, Chad, Equatorial Guinea
- **West Africa** (10): Ghana, Ivory Coast, Benin, Burkina Faso, Senegal, Togo, Mali, Guinea, Niger, Mauritania
- **Southern Africa** (4): Zambia, Zimbabwe, Malawi, Namibia
- **Indian Ocean** (4): Madagascar, Mauritius, Seychelles, Comoros
- **Horn of Africa** (1): Djibouti

### Database Schema
```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE,              -- ISO code: RW, UG, KE, etc.
  name TEXT,                      -- Country name
  currency_code TEXT,             -- RWF, UGX, KES, etc.
  phone_prefix TEXT,              -- +250, +256, +254, etc.
  
  -- Mobile Money
  mobile_money_provider TEXT,     -- MTN Mobile Money, Orange Money, etc.
  mobile_money_brand TEXT,        -- MoMo, Orange Money, M-Pesa, etc.
  ussd_send_to_phone TEXT,        -- *182*1*1*{phone}*{amount}#
  ussd_pay_merchant TEXT,         -- *182*8*1*{code}*{amount}#
  
  -- Metadata
  flag_emoji TEXT,                -- 🇷🇼, 🇺🇬, etc.
  timezone TEXT,                  -- Africa/Kigali, etc.
  is_active BOOLEAN,
  sort_order INTEGER
);
```

---

## 📱 Mobile Money Providers

### Provider Distribution
| Provider | Countries | Codes |
|----------|-----------|-------|
| MTN MoMo | 7 | BJ, CG, CM, GH, RW, UG, ZM |
| Orange Money | 7 | BF, CD, CF, CI, GN, ML, SN |
| Airtel Money | 5 | GA, MW, NE, SC, TD |
| M-Pesa | 2 | KE, TZ |
| EcoCash | 2 | BI, ZW |
| MVola | 2 | KM, MG |
| T-Money | 1 | TG |
| D-Money | 1 | DJ |
| GETESA | 1 | GQ |
| Moov Money | 1 | MR |
| MTC Money | 1 | NA |
| my.t money | 1 | MU |

---

## 🎯 Country-Specific Menu Names

### "MOMO QR Code" → Localized Names

| Country | Default Name | Localized Name | Provider |
|---------|--------------|----------------|----------|
| 🇷🇼 Rwanda | MOMO QR Code | **MOMO QR Code** | MTN MoMo |
| 🇨🇮 Ivory Coast | MOMO QR Code | **Orange Money QR** | Orange Money |
| 🇰🇪 Kenya | MOMO QR Code | **M-Pesa QR Code** | M-Pesa |
| 🇹🇿 Tanzania | MOMO QR Code | **M-Pesa QR Code** | M-Pesa |
| 🇬🇭 Ghana | MOMO QR Code | **MOMO QR Code** | MTN MoMo |
| 🇸🇳 Senegal | MOMO QR Code | **Orange Money QR** | Orange Money |
| 🇿🇲 Zambia | MOMO QR Code | **MOMO QR Code** | MTN MoMo |
| 🇿🇼 Zimbabwe | MOMO QR Code | **EcoCash QR Code** | EcoCash |
| 🇲🇬 Madagascar | MOMO QR Code | **MVola QR Code** | MVola |
| 🇹🇬 Togo | MOMO QR Code | **T-Money QR Code** | T-Money |

### How It Works
```typescript
// User in Rwanda (+250788123456)
const country = "RW";
const menuName = getLocalizedMenuName(item, country);
// → "MOMO QR Code"

// User in Ivory Coast (+225010123456)
const country = "CI";
const menuName = getLocalizedMenuName(item, country);
// → "Orange Money QR"
```

---

## 💡 USSD Codes

### Sample P2P Transfer Codes
| Country | Provider | USSD Pattern | Example |
|---------|----------|--------------|---------|
| Rwanda | MTN MoMo | `*182*1*1*{phone}*{amount}#` | *182\*1\*1\*0788...\*5000# |
| Ivory Coast | Orange Money | `*144*1*{phone}*{amount}#` | *144\*1\*0101...\*20000# |
| Kenya | M-Pesa | `*126*{phone}*{amount}#` | *126\*0712...\*1000# |
| Ghana | MTN MoMo | `*170*1*1*{phone}*{amount}#` | *170\*1\*1\*024...\*50# |
| Tanzania | M-Pesa | `*150*00*{phone}*{amount}#` | *150\*00\*0767...\*20000# |

### Merchant Payment Codes
| Country | Provider | USSD Pattern | Example |
|---------|----------|--------------|---------|
| Rwanda | MTN MoMo | `*182*8*1*{code}*{amount}#` | *182\*8\*1\*12345\*10000# |
| Ivory Coast | Orange Money | `*144*4*{code}*{amount}#` | *144\*4\*CIE123\*5000# |
| Kenya | M-Pesa | `*126*4*{code}*{amount}#` | *126\*4\*SHOP123\*2000# |

---

## 🛠️ Technical Implementation

### 1. Database View
```sql
CREATE VIEW whatsapp_menu_by_country AS
SELECT 
  c.code as country_code,
  c.name as country_name,
  c.mobile_money_brand,
  wm.key as menu_key,
  wm.name as default_name,
  COALESCE(
    (wm.country_specific_names->c.code->>'name')::text,
    wm.name
  ) as localized_name
FROM countries c
CROSS JOIN whatsapp_home_menu_items wm
WHERE c.code = ANY(wm.active_countries)
  AND c.is_active = true
  AND wm.is_active = true;
```

### 2. TypeScript Integration
```typescript
export interface WhatsAppHomeMenuItem {
  id: string;
  name: string;
  key: MenuItemKey;
  country_specific_names: Record<string, { 
    name?: string; 
    description?: string 
  }> | null;
}

export function getLocalizedMenuName(
  item: WhatsAppHomeMenuItem,
  countryCode: string,
): string {
  if (item.country_specific_names?.[countryCode]) {
    return item.country_specific_names[countryCode].name || item.name;
  }
  return item.name;
}
```

### 3. Dynamic Menu Fetching
```typescript
// Automatically applies country-specific names
const items = await fetchActiveMenuItems(countryCode, supabase);
// items[0].name → "Orange Money QR" (if country = CI)
```

---

## 📊 Menu Items per Country

| Country | Menu Items | Notes |
|---------|------------|-------|
| Rwanda | 12 | All features including Motor Insurance & Notary |
| Others | 10 | Excludes Motor Insurance & Notary Services |

### Menu Item Distribution
- **Available in all 31 countries**: Nearby Drivers, Nearby Passengers, Schedule Trip, Nearby Pharmacies, Quincailleries, Shops & Services, Property Rentals, MOMO QR (localized), Bars & Restaurants, Customer Support
- **Rwanda only**: Motor Insurance, Notary Services

---

## 🔍 Database Queries

### Get Country by Phone Number
```sql
-- Extract country from phone number
SELECT * FROM countries 
WHERE '+250788123456' LIKE phone_prefix || '%';
-- Returns: Rwanda
```

### Get Menu for Country
```sql
SELECT 
  localized_name,
  menu_key
FROM whatsapp_menu_by_country
WHERE country_code = 'CI'
ORDER BY display_order;
```

### Get USSD Code
```sql
SELECT 
  name,
  mobile_money_brand,
  ussd_send_to_phone
FROM countries
WHERE code = 'RW';
-- Returns: *182*1*1*{phone}*{amount}#
```

### Check All Localizations
```sql
SELECT 
  country_code,
  localized_name
FROM whatsapp_menu_by_country
WHERE menu_key = 'momo_qr'
ORDER BY country_code;
```

---

## 📁 Files Created

### Migrations
1. `20251113130000_countries_mobile_money.sql` - Countries table + country-specific naming
2. `20251113131000_expand_menu_countries.sql` - Expand menu to all 31 countries

### Test Scripts
- `test-countries-menu.sh` - Comprehensive testing

### Code Updates
- `domains/menu/dynamic_home_menu.ts` - Added `getLocalizedMenuName()` function

---

## ✅ Testing Results

```bash
✓ 31 countries created
✓ 12 mobile money providers configured
✓ Country-specific menu names working
✓ USSD codes stored for all countries
✓ Phone prefix mapping complete
✓ Dynamic menu view functional
```

Run tests:
```bash
bash test-countries-menu.sh
```

---

## 🎯 Key Benefits

✅ **Country-Aware** - Automatic phone number → country detection  
✅ **Localized UX** - Users see familiar brand names  
✅ **USSD Ready** - All payment codes stored and ready to use  
✅ **Scalable** - Easy to add new countries  
✅ **Dynamic** - Menu names change based on country  
✅ **Comprehensive** - 31 countries, 12 providers  

---

## 🚀 Usage Examples

### Example 1: User in Rwanda
```
Phone: +250788123456
Country: RW
Menu shows: "MOMO QR Code"
USSD: *182*1*1*{phone}*{amount}#
```

### Example 2: User in Ivory Coast
```
Phone: +225010123456
Country: CI
Menu shows: "Orange Money QR"
USSD: *144*1*{phone}*{amount}#
```

### Example 3: User in Kenya
```
Phone: +254712345678
Country: KE
Menu shows: "M-Pesa QR Code"
USSD: *126*{phone}*{amount}#
```

---

## 📞 Integration Points

### 1. WhatsApp Webhook
```typescript
const countryCode = getCountryFromPhone(ctx.from); // "CI"
const menuItems = await fetchActiveMenuItems(countryCode);
// menuItems[x].name → "Orange Money QR" (automatically)
```

### 2. Admin Panel
- View countries: `/countries`
- Manage menu items: `/whatsapp-menu`
- Toggle country availability per menu item

### 3. QR Code Generation
```typescript
const country = await getCountryByCode('RW');
const ussdCode = country.ussd_pay_merchant
  .replace('{code}', merchantCode)
  .replace('{amount}', amount);
// → *182*8*1*12345*10000#
```

---

## 📈 Statistics

- **Countries**: 31
- **Mobile Money Providers**: 12
- **Menu Items**: 12
- **Country-Specific Names**: 31 (for MOMO QR)
- **USSD Codes**: 62 (send + pay for each country)

---

## 🔄 Future Enhancements

1. **Admin UI for Countries** - Manage countries from admin panel
2. **Currency Conversion** - Auto-convert amounts based on currency
3. **Language Support** - Add French/Swahili translations per country
4. **USSD Integration** - Auto-generate USSD links in QR codes
5. **Country Analytics** - Track usage per country

---

## Status: ✅ Complete and Production-Ready

**Implementation Date**: 2025-11-13  
**Migration Versions**: 20251113130000, 20251113131000  
**Countries**: 31  
**Providers**: 12  
**Test Coverage**: Comprehensive  

**Ready for**: Production deployment and immediate use

