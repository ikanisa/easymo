# Workflow Verification Results

| Workflow                     | Status      | Evidence                                                                                                         |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Basket create/join/share     | Completed   | `bkt_12f3` + `basket_joins` evidence (staging 2025-09-24 08:25Z).                                                |
| Marketplace browse           | Completed   | WA list screenshot + `businesses` row `biz_77c9` (approved 2025-09-24).                                          |
| Wallet menu                  | Completed   | Console capture of wallet summary + structured log `WALLET_MENU_OPEN`.                                           |
| MoMo QR                      | Completed   | Generated QR image + log `MOMO_QR_GENERATED` (admin flow run 2025-09-24).                                        |
| Insurance OCR upload         | Completed   | Storage path `insurance/ocr/2025-09-24-claim1.pdf` + admin alert notification.                                   |
| Admin `/sub` commands        | Completed   | Flow response screenshot + audit row `admin_sub_command` (ref `SUB-219`).                                        |
| Notification queue auto-send | In progress | `deno test supabase/functions/wa-webhook/notify/sender.test.ts` (needs network) + cron logs to capture next run. |
| Mobility matching v2         | In progress | Migration `20251006162000_matching_v2_geography.sql`; staging validation captured in analysis doc.               |
| OCR worker pipeline          | In progress | `deno test --allow-env supabase/functions/ocr-processor/index.test.ts` (stubs OpenAI)                            |
