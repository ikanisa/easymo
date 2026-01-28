# Vendor Outreach Template v1

Standard WhatsApp message template for vendor inquiries.

---

## Template Format

```
Hi! 👋 EasyMO request:

Client needs: {normalized_need}
Category: {category}

Questions:
1. In stock? (yes/no)
2. Price range? (RWF)
3. Your location/landmark?
4. Any options (color/model)?

Reply example: "1. yes 2. 15k-20k 3. Kimironko 4. black or white"
```

---

## Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{normalized_need}` | Cleaned/normalized client request | "Amoxicillin 500mg, 10 tablets" |
| `{category}` | Product category | "pharmacy" |

---

## Reply Format

Vendors are encouraged to reply in numbered format:

```
1. [stock status: yes/no]
2. [price or price range in RWF]
3. [location or landmark]
4. [available options if any]
```

---

## Parsing Rules

The `replyParser` module handles:
- **Prices**: "15k" → 15000, "15k-30k" → range, "20,000" → 20000
- **Availability**: "yes", "available", "in stock" → in_stock
- **Location**: Extracts landmarks (Kimironko, Nyabugogo, etc.)
- **Options**: Splits on commas, "or", "and"

---

## Multilingual Support

Parser recognizes:
- **English**: yes, no, available, not available
- **French**: oui, non, disponible, pas disponible
- **Kinyarwanda**: niba, iri, dufite, ntibayo, ntidufite
