import { expect,test } from '@playwright/test';

test.describe('PWA assets accessibility', () => {
  test('manifest and service worker are publicly accessible on login', async ({ page, request }) => {
    await page.goto('/login');

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.status()).toBe(200);
    const manifestJson = await manifest.json();
    expect(manifestJson.name).toBeTruthy();

    const sw = await request.get('/sw.js');
    expect(sw.status()).toBe(200);
    const swText = await sw.text();
    expect(swText).toContain('self.addEventListener');
  });
});

