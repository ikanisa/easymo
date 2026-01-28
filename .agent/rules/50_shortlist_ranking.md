# Shortlist Ranking Rules

## Purpose
Score and rank vendor replies to produce the best options for the client.

## Scoring Formula

### Availability Score
| Availability | Score |
|-------------|-------|
| `in_stock` | +50 |
| `unclear` | +10 |
| `out_of_stock` | -100 |

### Price Fit Score
| Fit | Score |
|-----|-------|
| Within client budget | +20 |
| Slightly above budget (≤20%) | +5 |
| No budget specified | +10 |

### Distance Score (if location available)
| Distance | Score |
|----------|-------|
| ≤2 km | +15 |
| ≤5 km | +10 |
| ≤10 km | +5 |
| >10 km or unknown | +0 |

### Reply Confidence Score
- Add `confidence × 20` to the score
- Confidence is 0.0–1.0 from the reply parser

### Response Speed Score
- First responder: +10
- Response within 10 minutes: +8
- Response within 30 minutes: +5
- Response after 30 minutes: +0

## Hard Constraints

1. **Max Items**: Output at most 5 vendors
2. **Exclude Out-of-Stock**: If there are in_stock alternatives, exclude out_of_stock vendors entirely
3. **No Duplicates**: Same vendor cannot appear twice
4. **Minimum Score**: Exclude vendors with negative total scores unless no alternatives exist

## Ranking Order

1. Sort by total score descending
2. For ties, prefer:
   - Higher availability confidence
   - Lower price
   - Faster response time

## Example Calculation

Vendor A:
- Availability: in_stock (+50)
- Price within budget (+20)
- Distance 3km (+10)
- Confidence 0.85 (+17)
- Response in 15 min (+5)
- **Total: 102**

Vendor B:
- Availability: unclear (+10)
- No price given (+0)
- Distance unknown (+0)
- Confidence 0.4 (+8)
- Response in 45 min (+0)
- **Total: 18**

Vendor A ranks higher.
