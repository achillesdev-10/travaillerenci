import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 1. Home page — full page screenshot
console.log('Loading home page...');
await page.goto(`${BASE}`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test-results/home-full.png', fullPage: true });
console.log('✅ Home full page saved');

// 2. Poll widget — find it and screenshot
const pollWidget = page.locator('[aria-label="Sondage"]');
if (await pollWidget.count() > 0) {
  await pollWidget.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await pollWidget.screenshot({ path: 'test-results/poll-widget.png' });
  console.log('✅ Poll widget screenshot saved');
  
  // Check for countdown text
  const countdownText = await pollWidget.textContent();
  console.log('Poll widget text:', countdownText?.slice(0, 200));
} else {
  console.log('⚠ Poll widget not found on home page');
}

// 3. Concours page — check SVG illustrations
console.log('Loading concours page...');
await page.goto(`${BASE}/concours`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test-results/concours-full.png', fullPage: true });
console.log('✅ Concours full page saved');

// Check for exam cards with SVG images
const examCards = page.locator('article');
const cardCount = await examCards.count();
console.log(`Found ${cardCount} exam cards`);

// Check if SVG data URIs are used in images
const images = page.locator('img[src^="data:image/svg+xml"]');
const svgImgCount = await images.count();
console.log(`Found ${svgImgCount} SVG data URI images`);

if (cardCount > 0) {
  // Screenshot first 3 cards area
  const firstCard = examCards.first();
  await firstCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await firstCard.screenshot({ path: 'test-results/exam-card-first.png' });
  console.log('✅ First exam card screenshot saved');
}

await browser.close();
console.log('Done! All screenshots saved in test-results/');
