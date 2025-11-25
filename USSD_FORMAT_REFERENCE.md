# USSD Payment Integration - Correct Format

## CRITICAL: USSD Code Formats

The correct USSD codes for Rwanda Mobile Money are:

### Pay to Phone Number
```
*182*1*1*[phone_number]*[amount]#
```
Example: `*182*1*1*0788123456*5000#`

### Pay to Merchant Code
```
*182*8*1*[merchant_code]*[amount]#
```
Example: `*182*8*1*EASYMO*5000#`

## Implementation

### Token Purchase (wallet/purchase.ts)
Uses merchant code format:
```typescript
const ussdCode = `*182*8*1*${merchantCode}*${rwfAmount}#`;
```

- User taps `tel:` link to auto-dial
- USSD menu opens automatically
- User enters reference code when prompted
- Payment is processed

### Cash-Out (wallet/cashout.ts)
Admin processes manually using phone number format:
```typescript
// Admin dials: *182*1*1*{user_phone}*{amount}#
```

- User requests cash-out
- Tokens deducted immediately
- Admin receives notification
- Admin dials USSD to send money
- User receives cash in mobile money

## Environment Variables

```bash
USSD_MERCHANT_CODE=EASYMO    # Your registered merchant code
```

## Notes

- **DO NOT** use `*182*7*1*` format (incorrect)
- **DO NOT** use MoMo API (not available)
- **USSD only** - manual processing via tel: protocol
- Reference codes are entered by user when USSD prompts
- Admin processes all cash-outs manually

## Testing

Purchase flow:
1. User selects token amount
2. System shows: `tel:*182*8*1*EASYMO*5000#`
3. User taps link
4. USSD opens: "Enter reference:"
5. User enters reference code
6. Payment completes
7. Admin confirms → Tokens credited

Cash-out flow:
1. User requests 10,000 tokens cash-out
2. Admin sees pending request
3. Admin dials: `*182*1*1*0788123456*5000#`
4. User receives cash
5. Admin marks as completed
