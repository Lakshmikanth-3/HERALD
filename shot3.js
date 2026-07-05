const { chromium } = require('playwright');
const path = require('path');
const outDir = 'C:\\Users\\sl\\AppData\\Local\\Temp\\claude\\C--hack-lepton\\d9b0ff7a-9a64-4d34-9b2e-3860aaa9c020\\scratchpad\\live';

(async () => {
  const browser = await chromium.launch();
  for (const w of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    await page.goto('http://localhost:3000/economy', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, `economy-now-${w}.png`), fullPage: true });
  }
  await browser.close();
  console.log('done');
})();
