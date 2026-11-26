#!/usr/bin/env node
// Smoke test: runs the CLI against the demo page (known bugs) and a clean page, in both
// languages, and checks that every frame was measured and the known problems are found.
// A dashboard or probe change that breaks measuring fails here.
//
//   npm test            (or: node tools/smoke.mjs)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLEAN = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>A clean test page</title>
<meta name="description" content="A small page without problems, used by the Web Test Bench smoke test.">
<link rel="canonical" href="/clean"><link rel="icon" href="data:,">
<meta property="og:title" content="Clean"><meta property="og:image" content="data:,">
</head><body><h1>Clean page</h1><p>Nothing is wrong here.</p></body></html>`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/clean') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(CLEAN); return; }
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (file.includes('..')) { res.writeHead(400); res.end(); return; }
  try {
    const body = await readFile(join(ROOT, 'demo', file));
    res.writeHead(200, { 'content-type': TYPES[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const run = (url, lang) => new Promise((res) => {
  execFile(process.execPath, [join(ROOT, 'tools/wtb.mjs'), url, '--json', '--lang', lang, '--timeout', '40'], { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
    let report = null;
    try { report = JSON.parse(stdout); } catch { /* reported below */ }
    res({ code: err ? err.code : 0, report, stderr });
  });
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ' – ' + detail : ''}`);
  if (!ok) failed++;
};

try {
  for (const lang of ['en', 'cs']) {
    const { code, report: r, stderr } = await run(base + '/', lang);
    check(`[${lang}] demo: CLI printed a JSON report`, !!r, stderr.trim().slice(0, 300));
    if (!r) continue;
    const vps = r.viewports || {};
    check(`[${lang}] demo: exit code 1 (serious findings)`, code === 1, `got ${code}`);
    check(`[${lang}] demo: measurement finished`, r.ready === true);
    check(`[${lang}] demo: report language`, r.language === lang, r.language);
    for (const vp of ['mobile', 'tablet', 'desktop']) {
      check(`[${lang}] demo: ${vp} measured`, vps[vp] && vps[vp].status === 'ok' && !!vps[vp].perf, vps[vp] && vps[vp].status);
    }
    const ov = vps.mobile && vps.mobile.issues.overflow;
    check(`[${lang}] demo: mobile overflow caused by the price table`, !!ov && ov.items.some((i) => /table\.prices/.test(i.path)));
    check(`[${lang}] demo: no overflow on desktop`, vps.desktop && vps.desktop.horizontalOverflowPx === 0);
    const te = (r.console || []).find((e) => /toggle/.test(e.message));
    check(`[${lang}] demo: mobile-only script error`, !!te && te.viewports.join() === 'mobile', te && te.viewports.join());
    check(`[${lang}] demo: missing script reported as failed request`, (r.failedRequests || []).some((f) => /analytics\.js$/.test(f.url) && String(f.status) === '404'));
  }
  const { code, report: r } = await run(base + '/clean', 'en');
  check('clean page: exit code 0', code === 0, `got ${code}${r ? ': ' + r.findings.filter((f) => f.severity === 'bad').map((f) => f.text).join(' | ') : ''}`);
  check('clean page: passed', !!r && r.passed === true);
} finally {
  server.close();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
