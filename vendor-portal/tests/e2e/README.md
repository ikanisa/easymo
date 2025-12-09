# E2E Tests

This directory contains end-to-end tests for the Ibimina Staff Console using
Playwright.

## Test Suites

### Core Flows

#### Onboarding → SACCO → Approval Flow (`onboarding-sacco-approval.spec.ts`)

This test suite validates the complete member onboarding and approval workflow:

1. **Member Onboarding**: Member creates profile with contact information
2. **Add SACCO**: Member searches for and adds a SACCO
3. **Request to Join**: Member requests to join an ibimina group
4. **Staff Approval**: Staff member approves the join request
5. **Members Visible**: Approved member becomes visible in members list

**Test Cases:**

- Complete end-to-end workflow test
- Member can view their SACCO after adding it
- Staff can see pending join requests in approvals panel

### Authentication & Security

- `smoke.spec.ts` - Basic page rendering and authentication

### Accessibility & PWA

- `navigation.accessibility.spec.ts` - Navigation accessibility tests
- `offline.spec.ts` - Offline functionality

### Automation

- `automation-failures.spec.ts` - Automation failure handling

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm exec playwright test onboarding-sacco-approval

# Run in headed mode (see browser)
pnpm exec playwright test --headed

# Debug mode
pnpm exec playwright test --debug
```

## Test Environment

Tests run against a stubbed authentication environment (`AUTH_E2E_STUB=1`) to
avoid requiring real Supabase credentials. The test environment is configured in
`playwright.config.ts`.

### Session Management

Tests use the `setSession()` helper from `./support/session.ts` to manage
authentication state:

```typescript
await setSession(request, page, "authenticated"); // Authenticated user
await setSession(request, page, "anonymous"); // Anonymous/logged out
```

## CI/CD

E2E tests run automatically in CI via `.github/workflows/ci.yml`:

1. **Install Dependencies**: Playwright browsers installed
2. **Build Application**: Next.js application built
3. **Run Tests**: Tests execute against preview server
4. **Artifacts**: Test traces and reports uploaded on failure

Test results are available in the GitHub Actions artifacts:

- `playwright-traces`: Test execution traces
- `playwright-report`: HTML test report

## Writing New Tests

Follow these patterns when adding new tests:

```typescript
import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("Your Feature", () => {
  test.beforeEach(async ({ request, page }) => {
    await setSession(request, page, "authenticated");
  });

  test("should do something", async ({ page }) => {
    await page.goto("/your-page");
    await expect(page.getByRole("heading")).toBeVisible();
    // ... your test logic
  });
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole()`, `getByLabel()`,
   `getByText()` over CSS selectors
2. **Wait for elements**: Use `toBeVisible()` with timeouts rather than
   arbitrary waits
3. **Clean state**: Use `beforeEach` to set up consistent test state
4. **Descriptive names**: Test names should clearly describe what is being
   tested
5. **Independent tests**: Each test should be able to run independently

## Debugging

### View Test Report

```bash
pnpm exec playwright show-report .reports/playwright
```

### Run with Trace Viewer

```bash
pnpm exec playwright test --trace on
pnpm exec playwright show-trace trace.zip
```

### Common Issues

**Test times out waiting for element**

- Ensure the application is running correctly
- Check if authentication state is set properly
- Verify the selector matches the actual element

**Flaky tests**

- Avoid `page.waitForTimeout()`, use `waitForSelector()` or `toBeVisible()`
  instead
- Ensure proper wait conditions before interactions
- Check for race conditions in the application code

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Queries](https://testing-library.com/docs/queries/about) -
  Similar patterns
