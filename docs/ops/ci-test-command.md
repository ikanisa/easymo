# CI Test Commands

## Running E2E Tests

### Full E2E Suite
```bash
npm run test:e2e
```

### Individual Scenario
```bash
npm run test:e2e -- --grep "phone_case_happy_path"
```

### By Category Tag
```bash
# OCR scenarios
npm run test:e2e -- --grep "ocr"

# Security scenarios
npm run test:e2e -- --grep "security"

# Idempotency scenarios
npm run test:e2e -- --grep "idempotency"
```

## Package.json Script

Add this to `package.json`:
```json
{
  "scripts": {
    "test:e2e": "vitest run test/e2e/e2e.test.ts",
    "test:e2e:watch": "vitest test/e2e/e2e.test.ts",
    "test:e2e:coverage": "vitest run test/e2e/e2e.test.ts --coverage"
  }
}
```

## CI Pipeline Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run E2E Tests
        run: npm run test:e2e
        
      - name: Upload Test Results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results
          path: coverage/
```

## Test Scenarios

| File | Description | Tags |
|------|-------------|------|
| `01_phone_case_happy_path.json` | Full flow: clarify → outreach → shortlist | happy_path, electronics |
| `02_prescription_high_confidence.json` | High confidence OCR → pharmacy outreach | ocr, pharmacy |
| `03_prescription_low_confidence_clarify.json` | Low OCR triggers clarification | ocr, low_confidence |
| `04_vendor_injection_attempt.json` | Payment injection detected and excluded | security, injection |
| `05_calling_consent_gate.json` | Consent denied → call refused | calling, consent |
| `06_idempotency_double_webhook.json` | Duplicate webhooks ignored | idempotency |

## Performance Expectations

- Happy path scenario: < 2 seconds
- Full suite: < 30 seconds
- Individual scenario: < 5 seconds

## Adding New Scenarios

1. Create JSON file in `test/e2e/scenarios/`
2. Follow schema in `test/e2e/scenario.schema.json`
3. Add to test matrix in `e2e.test.ts`
4. Run validation: `npm run test:e2e -- --grep "new_scenario_name"`
