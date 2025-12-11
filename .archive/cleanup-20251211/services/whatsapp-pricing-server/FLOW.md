# WhatsApp Journey (Reference Script)

1. **Greeting** – Bot replies with a short intro plus a media prompt ("Send the vehicle pictures / yellow card / logbook").
2. **OCR Intake** – Images are pushed to `/simulate` (or via the webhook). `@insure/ocr-extract` pulls plate/VIN/make/model/usage/seats/owner hints.
3. **Confirm Facts** – Bot echoes what was extracted (vehicle type, usage, seats, suggested Sum Insured) and only asks for the missing fields: SI, cover selection, duration (short‑term vs annual), COMESA toggle/passenger count, occupant plan, installment option.
4. **Comparison Reply** – For every insurer we show:
   - Total premium.
   - Breakdown lines: TP base, seat loading, OTF, age loading, short-term factor, COMESA, occupant, fees, etc.
   - Mandatory excess summary + warnings (OTF age >15, missing info, etc.).
5. **Selection Assist** – Tap-to-select in WhatsApp (interactive list or quick replies). Bot replays the chosen breakdown and offers edit toggles (COMESA, occupant cover, installment mix).
6. **Payment** – `/paylink` (or the auto replies) provide the insurer’s dedicated MoMo USSD string and `tel:` deep link drawn from `packages/pricing-engine/src/insurers.ts`. Each insurer keeps its own merchant code/reference prefix so reconciliation stays clean.
7. **Fulfilment** – After payment confirmation, bot sends the cover note / certificate PDF.

The flow enforces the tariff constraints baked into `@insure/pricing-engine` (seat loadings, COMESA structure, short-term continuity, installment maximum of three tranches, age loading and OTF blocks after 15 years).
