# Product Taxonomy v1

Minimal taxonomy for Moltbot marketplace concierge.

---

## Categories

### 1. `electronics`

| Subcategory | Attributes | Examples |
|-------------|------------|----------|
| `phone_accessories` | `brand`, `model`, `accessory_type`, `color` | iPhone 15 case, Galaxy charger |
| `computers` | `brand`, `type`, `spec` | MacBook charger, laptop bag |
| `appliances` | `brand`, `type` | Blender, iron |

**Detection triggers:** iphone, samsung, galaxy, case, charger, laptop, macbook, phone

---

### 2. `pharmacy`

| Subcategory | Attributes | Examples |
|-------------|------------|----------|
| `prescription_meds` | `drug_name`, `form`, `dose`, `quantity` | Amoxicillin 500mg tablets |
| `otc` | `type`, `brand` | Panadol, bandages |

**Detection triggers:** OCR extraction, drug names, prescription, medicine, pharmacy

---

### 3. `groceries`

| Subcategory | Attributes | Examples |
|-------------|------------|----------|
| `fresh` | `type`, `quantity` | Tomatoes 5kg, bananas |
| `packaged` | `brand`, `type` | Nido milk, rice |
| `beverages` | `brand`, `type` | Coca-Cola, Primus |

**Detection triggers:** food, fruit, vegetable, milk, rice, sugar, water

---

### 4. `cosmetics`

| Subcategory | Attributes | Examples |
|-------------|------------|----------|
| `skincare` | `brand`, `type` | Nivea lotion, sunscreen |
| `haircare` | `brand`, `type` | Shampoo, hair oil |
| `makeup` | `brand`, `type` | Lipstick, foundation |

**Detection triggers:** lotion, cream, shampoo, soap, makeup, beauty

---

### 5. `hardware`

| Subcategory | Attributes | Examples |
|-------------|------------|----------|
| `tools` | `type`, `brand` | Hammer, screwdriver |
| `electrical` | `type`, `spec` | Light bulb, extension cord |
| `plumbing` | `type` | Pipe, faucet |

**Detection triggers:** tool, screw, nail, wire, pipe, bulb, electrical

---

## Attribute Schemas

### Common Attributes

```typescript
interface BaseAttributes {
  brand?: string;
  color?: string;
  quantity?: number;
  notes?: string;
}
```

### Electronics Attributes

```typescript
interface ElectronicsAttributes extends BaseAttributes {
  model?: string;           // "iPhone 15 Pro"
  accessory_type?: string;  // "case", "charger", "cable"
  spec?: string;            // "256GB", "M2 chip"
}
```

### Pharmacy Attributes

```typescript
interface PharmacyAttributes extends BaseAttributes {
  drug_name?: string;   // "Amoxicillin"
  form?: string;        // "tablets", "syrup", "injection"
  dose?: string;        // "500mg"
}
```

---

## Normalization Rules

1. **Exact match first** — check if query contains known product names
2. **Keyword detection** — scan for category trigger words
3. **OCR-driven** — if OCR detected drug names → `pharmacy/prescription_meds`
4. **Fallback** — `category: 'unknown'` triggers clarification flow

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-01-29 | Initial taxonomy with 5 categories |
