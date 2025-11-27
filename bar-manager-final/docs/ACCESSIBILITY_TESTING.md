# Accessibility Testing Guide

## Overview

This guide covers accessibility (a11y) testing for the admin-app, ensuring WCAG 2.1 Level AA compliance. All navigation components must meet these standards before deployment.

## Standards and Requirements

### WCAG 2.1 Level AA Compliance
We target WCAG 2.1 Level AA, which includes:
- **Perceivable**: Content is available to the senses
- **Operable**: Users can interact with all controls
- **Understandable**: Content and interface are comprehensible
- **Robust**: Content works with various technologies

### Key Requirements for Navigation
- ✅ Keyboard navigation (Tab, Enter, Space, Arrow keys)
- ✅ Screen reader compatibility
- ✅ Color contrast ratio ≥ 4.5:1 (normal text), ≥ 3:1 (large text)
- ✅ Focus indicators visible
- ✅ Skip links for keyboard users
- ✅ Proper ARIA attributes
- ✅ Semantic HTML
- ✅ Alternative text for non-text content

## Testing Tools

### Automated Testing
#### 1. axe-core (Playwright Integration)
```bash
cd admin-app
npm install -D @axe-core/playwright
```

Run accessibility tests:
```bash
cd tests/e2e/playwright
npx playwright test navigation-accessibility.e2e.spec.ts
```

#### 2. Lighthouse CI
```bash
npm install -g @lhci/cli
lhci autorun --collect.url=https://admin.easymo.app
```

### Manual Testing
#### Screen Readers
- **Windows**: NVDA (free), JAWS (paid)
- **macOS**: VoiceOver (built-in)
- **Linux**: Orca (free)

#### Browser Extensions
- axe DevTools (Chrome, Firefox)
- WAVE (Chrome, Firefox)
- Accessibility Insights (Chrome, Edge)

## Testing Procedures

### 1. Keyboard Navigation Testing

#### Test Checklist
- [ ] Tab key moves focus through interactive elements in logical order
- [ ] Shift+Tab moves focus backward
- [ ] Enter activates links and buttons
- [ ] Space activates buttons and toggles checkboxes
- [ ] Escape closes modals and menus
- [ ] Arrow keys navigate within components (menus, lists)
- [ ] Focus is visible at all times
- [ ] No keyboard traps

#### Testing Steps
```bash
# 1. Open the admin app
# 2. Press Tab repeatedly
# 3. Verify focus order: Skip link → Menu button → Search → Navigation links
# 4. Press Enter on focused elements to verify activation
# 5. Use Shift+Tab to navigate backward
```

### 2. Screen Reader Testing

#### VoiceOver (macOS)
```bash
# Enable: Cmd + F5
# Navigate: Control + Option + Arrow keys
# Read all: Control + Option + A
# Stop: Control
```

**Test Script:**
1. Turn on VoiceOver
2. Navigate to admin app
3. Use Tab to move through navigation
4. Verify announcements:
   - "Skip to main content, link"
   - "Primary navigation, navigation"
   - "Insurance Agent, current page, link"
   - "Admin Utilities, button, expanded"
5. Test all interactive elements

#### NVDA (Windows)
```bash
# Enable: Ctrl + Alt + N
# Navigate: Arrow keys or Tab
# Read all: Insert + Down Arrow
# Stop: Ctrl
```

**Test Script:**
1. Start NVDA
2. Open admin app in browser
3. Press Tab to navigate
4. Verify proper announcements for:
   - Links
   - Buttons
   - Current page
   - Expanded/collapsed states
5. Test all navigation paths

### 3. Color Contrast Testing

#### Automated Check
```typescript
// In navigation-accessibility.e2e.spec.ts
const accessibilityScanResults = await new AxeBuilder({ page })
  .withTags(['wcag2aa'])
  .include('.navigation')
  .analyze();
```

#### Manual Check
1. Use browser DevTools color picker
2. Check foreground vs background colors
3. Verify ratios:
   - Normal text (< 18pt): ≥ 4.5:1
   - Large text (≥ 18pt or 14pt bold): ≥ 3:1
   - UI components: ≥ 3:1

#### Common Issues
- Gray text on white background
- Blue links on dark blue background
- Disabled state too light

### 4. Focus Management Testing

#### Visible Focus Indicators
- [ ] Focus ring/outline visible on all interactive elements
- [ ] Focus ring color contrasts with background
- [ ] Focus ring is not removed by CSS
- [ ] Custom focus styles meet contrast requirements

#### Focus Order
- [ ] Focus moves in logical reading order
- [ ] Skip links are first in tab order
- [ ] Modals trap focus appropriately
- [ ] Focus returns to trigger after modal closes

#### Testing Focus
```javascript
// Check current focus
console.log(document.activeElement);

// Test focus trap in modal
// 1. Open modal
// 2. Tab through all elements
// 3. After last element, focus should cycle to first
// 4. Close modal
// 5. Focus should return to trigger button
```

### 5. ARIA Attributes Testing

#### Required ARIA for Navigation
```html
<!-- Navigation landmark -->
<nav aria-label="Primary navigation">

<!-- Current page -->
<a href="/page" aria-current="page">Page Title</a>

<!-- Expandable groups -->
<button aria-expanded="true" aria-controls="panel-id">
  Group Title
</button>
<div id="panel-id" role="group" aria-labelledby="button-id">
  <!-- Group content -->
</div>

<!-- Breadcrumbs -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li aria-current="page">Current Page</li>
  </ol>
</nav>
```

#### Validation Checklist
- [ ] All ARIA attributes have valid values
- [ ] ARIA references (aria-labelledby, aria-controls) point to existing IDs
- [ ] ARIA roles match element semantics
- [ ] No redundant ARIA (e.g., role="button" on <button>)
- [ ] ARIA states reflect actual UI state

### 6. Semantic HTML Testing

#### Best Practices
✅ Use semantic elements:
- `<nav>` for navigation
- `<main>` for main content
- `<header>` for page/section headers
- `<button>` for actions
- `<a>` for links

❌ Avoid:
- `<div>` for interactive elements
- Missing alt text on images
- Improper heading hierarchy

## Automated Testing

### Running A11y Tests

#### Full Suite
```bash
cd admin-app/tests/e2e/playwright
npx playwright test navigation-accessibility.e2e.spec.ts
```

#### Single Test
```bash
npx playwright test -g "sidebar navigation meets WCAG 2.1"
```

#### In CI
Tests run automatically on PRs. See `.github/workflows/admin-app-visual.yml`.

### Writing A11y Tests

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('component is accessible', async ({ page }) => {
  await page.goto('/page');
  
  const results = await new AxeBuilder({ page })
    .include('.component')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  
  expect(results.violations).toEqual([]);
});
```

## Common Issues and Fixes

### Issue: Missing focus indicator
**Fix:**
```css
*:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

### Issue: Low color contrast
**Fix:**
```css
/* Before: 3.1:1 */
.text-gray-400 { color: #9ca3af; }

/* After: 4.5:1 */
.text-gray-600 { color: #4b5563; }
```

### Issue: Non-descriptive link text
**Fix:**
```html
<!-- Before -->
<a href="/settings">Click here</a>

<!-- After -->
<a href="/settings">Open settings</a>
```

### Issue: Button implemented as div
**Fix:**
```html
<!-- Before -->
<div onclick="handleClick()">Submit</div>

<!-- After -->
<button type="button" onclick="handleClick()">Submit</button>
```

### Issue: Missing skip link
**Fix:**
```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<main id="main-content" tabindex="-1">
  <!-- Content -->
</main>
```

## Testing Workflow

### During Development
1. Use browser DevTools accessibility panel
2. Test keyboard navigation regularly
3. Run axe DevTools extension
4. Check color contrast with DevTools

### Before PR
1. Run automated a11y tests locally
2. Manual keyboard navigation test
3. Screen reader spot check (key flows)
4. Review ARIA attributes in DevTools

### In PR Review
1. Automated tests must pass
2. Reviewer tests keyboard navigation
3. Check focus management
4. Verify semantic HTML

### Before Deployment
1. Full screen reader test (VoiceOver or NVDA)
2. Lighthouse accessibility audit
3. Manual keyboard navigation of all new features
4. Verify in deployment checklist

## Browser Testing

### Minimum Browser Support
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

### Screen Reader + Browser Combinations
- **Windows**: NVDA + Firefox, JAWS + Chrome
- **macOS**: VoiceOver + Safari
- **Linux**: Orca + Firefox

## Reporting Issues

### Accessibility Bug Template
```markdown
**Issue**: [Brief description]

**WCAG Criterion**: [e.g., 2.1.1 Keyboard]

**Impact**: [Critical/Serious/Moderate/Minor]

**Steps to Reproduce**:
1. Navigate to [page]
2. Use [keyboard/screen reader]
3. Observe [issue]

**Expected**: [Accessible behavior]

**Actual**: [Current behavior]

**Screen Reader**: [If applicable]

**Browser**: [Name and version]

**Screenshot/Video**: [If helpful]
```

## Resources

### Standards
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Accessibility Insights](https://accessibilityinsights.io/)

### Learning
- [A11ycasts (YouTube)](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)
- [WebAIM Guides](https://webaim.org/articles/)
- [The A11Y Project](https://www.a11yproject.com/)

## Support

For accessibility questions:
- Slack: #accessibility
- Email: accessibility@easymo.app
- Review: Request a11y review in PR

## Appendix: WCAG Quick Reference

### Level A (Must Have)
- 1.1.1: Text alternatives
- 2.1.1: Keyboard accessible
- 2.1.2: No keyboard trap
- 3.1.1: Language of page
- 4.1.1: Parsing (valid HTML)
- 4.1.2: Name, role, value (proper ARIA)

### Level AA (Should Have - Our Target)
- 1.4.3: Contrast minimum (4.5:1)
- 1.4.5: Images of text
- 2.4.6: Headings and labels
- 2.4.7: Focus visible
- 3.2.3: Consistent navigation
- 3.2.4: Consistent identification

### ARIA Landmarks
- `<nav>`: Navigation
- `<main>`: Main content
- `<header>`: Banner
- `<footer>`: Contentinfo
- `<aside>`: Complementary
- `<form>`: Form (if named)
- `<section>`: Region (if named)
