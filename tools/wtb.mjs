#!/usr/bin/env node
// Web Test Bench from the terminal: loads the extension in Chromium, opens the bench for a
// URL, waits until all three viewports are measured and prints the report.
// Meant for AI agents (and CI) that should not need screenshots or DevTools to see what is wrong.
//
//   node tools/wtb.mjs <url> [--json] [--links] [--shots <dir>] [--sizes 375x667,768x1024,1440x900] [--timeout 45]

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VPS = ['mobile', 'tablet', 'desktop'];

const HELP = `Použití: node tools/wtb.mjs <url> [volby]

  --json              vypíše zprávu jako JSON (jinak Markdown)
  --links             zkontroluje i odkazy na stránce
  --shots <složka>    uloží snímky celé stránky pro každou velikost (PNG)
  --sizes <seznam>    velikosti mobil,tablet,desktop, např. 390x844,820x1180,1920x1080
  --timeout <s>       jak dlouho čekat na dokončení měření (výchozí 45)
  --chrome <cesta>    Chromium, který se má použít (nebo proměnná WTB_CHROME)

Návratový kód: 0 bez závažných problémů (✗), 1 když se našel závažný problém nebo měření nedoběhlo, 2 když se test nepovedl spustit.`;

function parseArgs(argv) {
  const o = { url: '', json: false, links: false, shots: '', sizes: null, timeout: 45, chrome: process.env.WTB_CHROME || '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--links') o.links = true;
    else if (a === '--shots') o.shots = argv[++i];
    else if (a === '--sizes') o.sizes = argv[++i];
    else if (a === '--timeout') o.timeout = +argv[++i];
    else if (a === '--chrome') o.chrome = argv[++i];
    else if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0); }
    else if (!a.startsWith('--') && !o.url) o.url = a;
    else { console.error('Neznámá volba: ' + a + '\n\n' + HELP); process.exit(2); }
  }
  if (!o.url) { console.error(HELP); process.exit(2); }
  // The URL is normalised by the bench itself (http for localhost, IPs and *.test, https otherwise).
  if (o.sizes) {
    const parts = o.sizes.split(',').map((s) => s.trim().match(/^(\d+)x(\d+)$/));
    if (parts.length !== 3 || parts.some((p) => !p)) { console.error('--sizes čeká tři velikosti ŠxV oddělené čárkou'); process.exit(2); }
    o.sizes = parts.map((p) => [+p[1], +p[2]]);
  }
  return o;
}

// Google Chrome 137+ ignores --load-extension, so prefer Chromium.
function findChromium(explicit) {
  if (explicit) return explicit;
  const pw = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(pw)) {
    const dirs = readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]);
    for (const d of dirs) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = join(pw, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']) if (existsSync(p)) return p;
  return '';
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch (e) {
    console.error('Chybí playwright-core. Spusť jednou v adresáři rozšíření: npm install');
    process.exit(2);
  }
  const exe = findChromium(o.chrome);
  if (!exe) { console.error('Nenašel jsem Chromium. Nainstaluj ho (např. npx playwright install chromium) nebo zadej --chrome <cesta>.'); process.exit(2); }

  const profile = mkdtempSync(join(tmpdir(), 'wtb-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: exe,
    headless: true,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    ignoreDefaultArgs: ['--hide-scrollbars'], // keep real scrollbars on the desktop viewport
    viewport: { width: 1920, height: 1200 },
  });
  let code = 2;
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = new URL(sw.url()).host;
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${extId}/dashboard.html`);
    await page.waitForFunction(() => !!window.webTestBench);
    if (o.sizes) await page.evaluate((sizes) => ['mobile', 'tablet', 'desktop'].forEach((vp, i) => window.webTestBench.setSize(vp, sizes[i][0], sizes[i][1])), o.sizes);
    const url = await page.evaluate((u) => window.webTestBench.load(u), o.url);
    if (!url) { console.error('Neplatná adresa: ' + o.url); process.exitCode = 2; return; }
    const ready = await page.evaluate((ms) => window.webTestBench.waitUntilReady(ms), o.timeout * 1000);
    if (o.links) {
      const limit = Math.max(30, o.timeout * 2) * 1000;
      await Promise.race([page.evaluate(() => window.webTestBench.checkLinks('all')), new Promise((res) => setTimeout(res, limit))]);
    }
    const report = await page.evaluate(() => window.webTestBench.report());
    const md = await page.evaluate(() => window.webTestBench.reportMarkdown());

    if (o.shots) {
      // Full-page screenshots in a normal tab at each size (not through the bench frames).
      mkdirSync(o.shots, { recursive: true });
      report.screenshots = {};
      for (const vp of VPS) {
        const v = report.viewports[vp];
        if (!v) continue;
        const shot = await ctx.newPage();
        // Same layout width as measured: phones and tablets have overlay scrollbars.
        if (vp !== 'desktop') await shot.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'html{scrollbar-width:none!important}html::-webkit-scrollbar{display:none!important}'; document.head.appendChild(st); }));
        await shot.setViewportSize({ width: v.width, height: v.height });
        await shot.goto(v.url || report.url, { waitUntil: 'load', timeout: o.timeout * 1000 }).catch(() => {});
        await shot.waitForTimeout(800);
        const file = join(resolve(o.shots), `${vp}-${v.width}x${v.height}.png`);
        await shot.screenshot({ path: file, fullPage: true });
        report.screenshots[vp] = file;
        await shot.close();
      }
    }

    if (o.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    else {
      process.stdout.write(md + '\n');
      if (report.screenshots) process.stdout.write('\n## Snímky\n\n' + Object.entries(report.screenshots).map(([vp, f]) => `- ${vp}: ${f}`).join('\n') + '\n');
    }
    if (!ready) process.stderr.write('Pozor: měření nedoběhlo do ' + o.timeout + ' s, zpráva může být neúplná.\n');
    code = report.passed ? 0 : 1;
  } catch (e) {
    console.error('Test se nepovedl: ' + e.message);
    code = 2;
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
  process.exit(code);
}

main();
