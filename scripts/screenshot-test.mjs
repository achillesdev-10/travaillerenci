import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const pages = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog' },
  { name: 'concours', path: '/concours' },
  { name: 'companies', path: '/companies' },
  { name: 'cv-generator', path: '/generateur-de-cv' },
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const p of pages) {
  const page = await context.newPage();
  await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 30000 });
  // Wait a bit for animations
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `test-results/${p.name}.png`, fullPage: true });
  console.log(`✅ ${p.name} — ${p.path}`);
  await page.close();
}

await browser.close();
console.log('Done! Screenshots saved in test-results/');
