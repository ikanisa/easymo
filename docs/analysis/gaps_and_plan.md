# Gaps & Follow-up Plan

| Priority | Gap                              | Proposed Fix                                                  | Owner       | ETA (hrs) | Test steps                         | Rollback              |
| -------- | -------------------------------- | ------------------------------------------------------------- | ----------- | --------- | ---------------------------------- | --------------------- |
| P0       | Broadcast/template flows stubbed | Implement actual actions + audit for template preview/send    | DONE        | 6         | Postman call, Flow replay          | Revert new handlers   |
| P0       | OCR worker pending               | Build /media/ocr function, integrate with OpenAI, write tests | In progress | 8         | Upload fixture, verify menus       | Disable worker        |
| P0       | Fuel voucher rollout             | Implement voucher issuance/redeem flows + PNG rendering       | In progress | 6         | Issue + redeem via admin flow      | Remove voucher tables |
| P1       | Notification worker schedule     | Configure Supabase cron to hit `/notification-worker`         | DONE        | 1         | Check notifications status changes | Remove schedule       |
| P1       | Flow JSON localisation           | Review copy lengths for final design                          | TODO        | 2         | Meta validation                    | Revert JSON           |
| P2       | Admin diagnostics details        | Add RPC for match counts, error logs                          | TODO        | 4         | Call diag flow                     | Skip RPC              |
