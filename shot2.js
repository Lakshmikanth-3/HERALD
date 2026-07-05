const { chromium } = require('playwright');
const path = require('path');

const outDir = 'C:\\Users\\sl\\AppData\\Local\\Temp\\claude\\C--hack-lepton\\d9b0ff7a-9a64-4d34-9b2e-3860aaa9c020\\scratchpad\\live';

const widths = [1440, 1280, 1024, 900, 768, 640, 500, 390];

(async () => {
  const fs = require('fs');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();

  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:3000/economy', { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      const nav = document.querySelector('.nav');
      const grid = document.querySelector('.economy-grid');
      const canvas = document.querySelector('canvas');
      return {
        vw, scrollWidth: sw, overflow: sw > vw + 2,
        navRect: nav ? nav.getBoundingClientRect() : null,
        navScrollWidth: nav ? nav.scrollWidth : null,
        gridRect: grid ? grid.getBoundingClientRect() : null,
        gridComputedCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
        canvasRect: canvas ? canvas.getBoundingClientRect() : null,
        canvasAttrWidth: canvas ? canvas.width : null,
        canvasAttrHeight: canvas ? canvas.height : null,
        bodyHTML_length: document.body.innerHTML.length,
      };
    });

    await page.screenshot({ path: path.join(outDir, `economy-w${w}.png`), fullPage: true });
    console.log(`\n=== width ${w} ===`);
    console.log(JSON.stringify(info, null, 2));
    if (consoleErrors.length) console.log('CONSOLE ERRORS:', consoleErrors);
    if (pageErrors.length) console.log('PAGE ERRORS:', pageErrors);
    await page.close();
  }

  await browser.close();
})();
