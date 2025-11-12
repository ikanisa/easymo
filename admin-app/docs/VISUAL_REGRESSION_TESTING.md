# Visual Regression Testing Guide

## Overview

Visual regression testing ensures that UI changes don't introduce unintended visual bugs. We use Playwright to capture screenshots and compare them against baseline images.

## Setup

### Prerequisites
- Node.js 18+
- pnpm 10.18.3+
- Playwright browsers installed

### Installation
```bash
cd admin-app
npm install -D @playwright/test
npx playwright install --with-deps chromium firefox
```

## Running Visual Tests

### Local Development

#### 1. Start the Development Server
```bash
cd admin-app
npm run dev
```

#### 2. Run Visual Tests
```bash
cd tests/e2e/playwright
npx playwright test navigation-visual.e2e.spec.ts
```

### Updating Baselines

When you intentionally change the UI, update the baseline screenshots:

```bash
cd admin-app/tests/e2e/playwright
npx playwright test navigation-visual.e2e.spec.ts --update-snapshots
```

**Important:** Review all updated screenshots before committing them!

### Viewing Test Results

#### After Test Runs
```bash
# Open HTML report
npx playwright show-report
```

#### Compare Failed Screenshots
Failed tests generate three files:
- `*-actual.png` - Current screenshot
- `*-expected.png` - Baseline screenshot  
- `*-diff.png` - Visual difference highlighting

## Test Organization

### Test Structure
```
admin-app/tests/e2e/playwright/
├── playwright.config.ts          # Playwright configuration
├── specs/
│   ├── navigation-visual.e2e.spec.ts       # Visual regression tests
│   ├── navigation-accessibility.e2e.spec.ts # A11y tests
│   ├── admin-app.e2e.spec.ts              # Functional E2E tests
│   └── critical-flows.e2e.spec.ts         # Smoke tests
├── test-results/                 # Test output (gitignored)
└── screenshots/                  # Baseline screenshots (committed)
    ├── chromium/
    └── firefox/
```

### Screenshot Naming Convention
Screenshots are automatically named based on the test:
- `sidebar-default-desktop.png`
- `sidebar-active-nested.png`
- `mobile-menu-open.png`
- `breadcrumbs-nested.png`

## Best Practices

### 1. Test Stability
- Always wait for page to be fully loaded
- Use `page.waitForLoadState('networkidle')` for async content
- Wait for animations to complete before capturing screenshots
- Mock API responses to ensure consistent data

### 2. Screenshot Scope
- Capture specific components when possible (use `element.screenshot()`)
- Use full page screenshots only when necessary
- Exclude dynamic content (timestamps, random IDs) from comparison areas

### 3. Thresholds
Configure acceptable differences in `playwright.config.ts`:
```typescript
use: {
  screenshot: {
    maxDiffPixels: 100,  // Allow up to 100 pixels to differ
  },
}
```

### 4. Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names
- Keep tests focused on single UI states
- Document expected behavior in comments

## Common Issues and Solutions

### Issue: Screenshots differ due to fonts
**Solution:** Install system fonts in CI or use font mocking

### Issue: Timestamps or dynamic IDs cause failures
**Solution:** Mock data or exclude dynamic regions:
```typescript
await expect(page).toHaveScreenshot({
  mask: [page.locator('.timestamp')],
});
```

### Issue: Different screen densities cause issues
**Solution:** Set device scale factor explicitly:
```typescript
await page.setViewportSize({ 
  width: 1280, 
  height: 720,
  deviceScaleFactor: 1,
});
```

### Issue: Animations cause flaky tests
**Solution:** Disable animations or wait for completion:
```typescript
await page.addStyleTag({
  content: '* { animation: none !important; transition: none !important; }'
});
```

## CI/CD Integration

### GitHub Actions Workflow
Visual tests run automatically on PRs that modify:
- `admin-app/components/**`
- `admin-app/app/**`
- Test files

See `.github/workflows/admin-app-visual.yml` for configuration.

### Reviewing Results in CI
1. Go to the PR's "Checks" tab
2. Click on "Visual Regression Tests"
3. Download artifacts to view screenshots
4. Review diff images if tests failed

### Approving Visual Changes
1. Review all screenshot diffs
2. If changes are intentional:
   ```bash
   npx playwright test --update-snapshots
   git add admin-app/tests/e2e/playwright/screenshots/
   git commit -m "Update visual regression baselines"
   git push
   ```
3. If changes are bugs, fix the code and re-run tests

## Component Coverage

### Current Coverage
✅ Navigation Sidebar
- Default state
- Active root link
- Active nested link
- Collapsed group
- Hover state
- Focus state

✅ Mobile Navigation
- Closed state
- Open state
- Overlay visibility

✅ Breadcrumbs
- Root page
- Nested pages
- Hover states

✅ Search Integration
- Search button
- Hover state

✅ Responsive Breakpoints
- Mobile (375px)
- Tablet (768px)
- Desktop (1280px)
- Wide (1920px)

✅ Accessibility Indicators
- Skip link on focus
- Active page indicator dot
- Keyboard hint footer

### Adding New Coverage
When adding new navigation components:

1. Create a new test in `navigation-visual.e2e.spec.ts`:
```typescript
test('new component default state', async ({ page }) => {
  await page.goto('/page-with-component');
  await page.waitForSelector('.new-component');
  
  const component = page.locator('.new-component');
  await expect(component).toHaveScreenshot('new-component-default.png');
});
```

2. Run test to generate baseline:
```bash
npx playwright test --update-snapshots
```

3. Verify baseline looks correct
4. Commit baseline to git

## Performance Considerations

### Test Speed
- Visual tests are slower than unit tests
- Run full suite in CI only
- Run subset locally during development:
  ```bash
  npx playwright test navigation-visual.e2e.spec.ts --grep="sidebar"
  ```

### Storage
- Screenshots add to repository size
- Compress screenshots before committing
- Consider using external screenshot storage for large projects

## Maintenance

### Regular Review
- Review baselines quarterly
- Remove unused screenshots
- Update tests when components change
- Keep test documentation current

### Version Control
- Commit baseline screenshots to git
- Include in code review process
- Document baseline updates in commit messages
- Tag major baseline updates

## Troubleshooting

### Tests Pass Locally But Fail in CI
**Causes:**
- Font rendering differences
- Different browser versions
- System-dependent rendering

**Solutions:**
- Run tests in Docker locally
- Use consistent browser versions
- Normalize fonts and rendering

### High False Positive Rate
**Solutions:**
- Increase `maxDiffPixels` threshold
- Stabilize test environment
- Remove dynamic content
- Use more specific selectors

### Slow Test Execution
**Solutions:**
- Parallelize test execution
- Reduce number of screenshots
- Use faster test infrastructure
- Cache browser installations

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Visual Testing Best Practices](https://playwright.dev/docs/test-snapshots)
- [Accessibility Testing Guide](./ACCESSIBILITY_TESTING.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)

## Support

For questions or issues:
- Check existing test examples in `specs/`
- Review Playwright docs
- Ask in #engineering-frontend Slack channel
- Contact @frontend-lead
