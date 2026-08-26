import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 1. Register a test account
console.log('Registering test account...');
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);

// Fill register form
await page.fill('input[placeholder="Koffi Kouadio"]', 'Test User');
await page.fill('input[placeholder="vous@exemple.ci"]', 'testdash2@example.com');
await page.fill('input[type="password"]:first-of-type', 'testpass123');
const confirmPassword = page.locator('input[type="password"]').nth(1);
await confirmPassword.fill('testpass123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log('Current URL after register:', page.url());

// 2. Screenshot the dashboard
await page.goto(`${BASE}/dashboard/candidate`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test-results/dashboard-candidate.png', fullPage: true });
console.log('✅ Dashboard screenshot saved');

// 3. Screenshot header area (logged in state)
await page.screenshot({ path: 'test-results/header-logged-in.png', clip: { x: 0, y: 0, width: 1440, height: 80 } });
console.log('✅ Header (logged in) screenshot saved');

// 4. Screenshot login page (logged out header)
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test-results/header-logged-out.png', clip: { x: 0, y: 0, width: 1440, height: 80 } });
console.log('✅ Header (logged out) screenshot saved');

await browser.close();
console.log('Done!');
