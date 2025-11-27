# MTN Rwanda MOMO USSD Code Research
**Date**: 2025-11-23

## Standard MTN Rwanda USSD Codes

### Official MTN MoMo USSD Structure

**Base Code**: `*182#`

### Payment Types

1. **Send Money to Phone Number**
   - Code: `*182*1*1*PHONE*AMOUNT#`
   - Example: `*182*1*1*788123456*1000#`

2. **Pay to Merchant Code**
   - Code: `*182*8*1*MERCHANT_CODE*AMOUNT#`
   - Example: `*182*8*1*123456*1000#`
   - Note: MTN Rwanda uses `*182*8*1*` for merchant payments

3. **Pay Bill** (Alternative merchant format)
   - Code: `*182*2*1*BILL_CODE*AMOUNT#`
   - Used for: Utility bills, RURA, government services
   - Different from merchant code payments

## Verification

The example code uses `*182*2*1*` which is for **bill payments**, not merchant codes.

**Current implementation is CORRECT** ✅

- Rwanda merchant payments: `*182*8*1*CODE#`
- Rwanda bill payments: `*182*2*1*CODE#`

## Recommendation

**NO CHANGE NEEDED** - Current implementation is correct for Rwanda merchant payments.

The example may have been showing bill payment format, or from a different country's MoMo system.

---

Source: MTN Rwanda MoMo USSD documentation
