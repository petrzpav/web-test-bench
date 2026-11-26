// Web Test Bench dashboard.
// Frames talk to us through content/probe.js (window.postMessage) and
// content/bridge.js (chrome.runtime, gives us their frameId for webRequest).

// ---------------------------------------------------------------- language
// Czech or English. Chosen in the settings (stored in localStorage so it is known before the
// first render), by ?lang= (used by the CLI), or else by the browser's language.
const LANG = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'cs' || q === 'en') return q;
  let s = null;
  try { s = localStorage.getItem('wtb-lang'); } catch (e) { /* storage blocked */ }
  if (s === 'cs' || s === 'en') return s;
  return /^(cs|sk)\b/i.test(navigator.language || '') ? 'cs' : 'en';
})();
const T = (cs, en) => (LANG === 'cs' ? cs : en);
const LOCALE = T('cs-CZ', 'en-US');
document.documentElement.lang = LANG;
// Static texts in dashboard.html are English; data-cs* attributes carry the Czech version.
if (LANG === 'cs') {
  for (const el of document.querySelectorAll('[data-cs]')) el.textContent = el.dataset.cs;
  for (const el of document.querySelectorAll('[data-cs-html]')) el.innerHTML = el.dataset.csHtml; // static markup from our own HTML
  for (const [attr, key] of [['title', 'csTitle'], ['aria-label', 'csAriaLabel'], ['placeholder', 'csPlaceholder']]) {
    for (const el of document.querySelectorAll(`[data-cs-${attr}]`)) el.setAttribute(attr, el.dataset[key]);
  }
}

const VPS = ['mobile', 'tablet', 'desktop'];
const VP_NAME = { mobile: T('Mobil', 'Mobile'), tablet: 'Tablet', desktop: 'Desktop' };
const VP_SHORT = { mobile: 'M', tablet: 'T', desktop: 'D' };

const PRESETS = [
  { id: 'iphone-se', group: VP_NAME.mobile, name: 'iPhone SE', w: 375, h: 667 },
  { id: 'iphone-15', group: VP_NAME.mobile, name: 'iPhone 15', w: 393, h: 852 },
  { id: 'galaxy-s23', group: VP_NAME.mobile, name: 'Galaxy S23', w: 360, h: 780 },
  { id: 'pixel-8', group: VP_NAME.mobile, name: 'Pixel 8', w: 412, h: 915 },
  { id: 'ipad-mini', group: 'Tablet', name: 'iPad mini', w: 768, h: 1024 },
  { id: 'ipad-air', group: 'Tablet', name: 'iPad Air', w: 820, h: 1180 },
  { id: 'ipad-pro', group: 'Tablet', name: T('iPad Pro 12,9″', 'iPad Pro 12.9″'), w: 1024, h: 1366 },
  { id: 'laptop', group: 'Desktop', name: T('Notebook', 'Laptop'), w: 1366, h: 768 },
  { id: 'laptop-hd', group: 'Desktop', name: T('Notebook HD+', 'Laptop HD+'), w: 1440, h: 900 },
  { id: 'fullhd', group: 'Desktop', name: 'Full HD', w: 1920, h: 1080 },
];

const CHECKLISTS = { cs: [
  'Hlavní navigace i mobilní menu se otevřou a vedou správně',
  'Na mobilu není vodorovný posun ani useknutý obsah',
  'Formuláře: povinná pole, chybové hlášky, úspěšné odeslání',
  'Tlačítka a odkazy mají hover, fokus a aktivní stav',
  'Obrázky jsou ostré, nedeformované a mají alt',
  'Texty bez překlepů, bez nepřeložených klíčů a zástupného textu',
  'Klávesnicí (Tab) projdu stránku a fokus je vidět',
  'Titulek, popis a náhled pro sdílení odpovídají stránce',
  'Neexistující adresa ukáže srozumitelnou stránku 404',
  'Konzole bez chyb a síť bez neúspěšných požadavků',
], en: [
  'Main navigation and the mobile menu open and lead to the right pages',
  'No horizontal scrolling or cut-off content on mobile',
  'Forms: required fields, error messages, successful submit',
  'Buttons and links have hover, focus and active states',
  'Images are sharp, not distorted, and have alt text',
  'Texts have no typos, untranslated keys or placeholder text',
  'I can go through the page with the keyboard (Tab) and see the focus',
  'Title, description and share preview match the page',
  'A missing address shows a clear 404 page',
  'Console without errors and network without failed requests',
] };
const DEFAULT_CHECKLIST = CHECKLISTS[LANG];

const DEFAULTS = {
  panes: {
    mobile: { preset: 'iphone-se', w: 375, h: 667, hidden: false },
    tablet: { preset: 'ipad-mini', w: 768, h: 1024, hidden: false },
    desktop: { preset: 'laptop-hd', w: 1440, h: 900, hidden: false },
  },
  zoom: 'fit',
  syncScroll: true,
  syncNav: true,
  mobileUA: false,
  keepLog: false,
  overlays: { outline: false, overflow: false, a11y: false },
  dockHeight: 300,
  dockMode: 'open', // open | min | hidden
  order: ['mobile', 'tablet', 'desktop'], // display order of the viewports, set by dragging the chips
  activeTab: 'console',
  history: [],
};

const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  forward: '<path d="M9 18l6-6-6-6"/>',
  reload: '<path d="M20 11a8 8 0 1 0-2.4 5.7"/><path d="M20 4v7h-7"/>',
  rotate: '<rect x="5" y="2" width="9" height="14" rx="1.5"/><path d="M19.5 11v3.5a5 5 0 0 1-5 5H11"/><path d="M13.5 17l-2.5 2.5 2.5 2.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minimize: '<path d="M6 9l6 6 6-6"/>',
  expand: '<path d="M6 15l6-6 6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};

// ---------------------------------------------------------------- helpers

const $ = (sel, root = document) => root.querySelector(sel);
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v; // only ever used with static icon markup
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3, minimumFractionDigits: 3 });
const fmtMs = (v) => v === null || v === undefined ? '–' : v < 1000 ? nf0.format(v) + ' ms' : nf2.format(v / 1000) + ' s';
const fmtBytes = (v) => !v ? '–' : v < 1024 ? nf0.format(v) + ' B' : v < 1024 * 1024 ? nf0.format(v / 1024) + ' kB' : nf1.format(v / 1024 / 1024) + ' MB';
const fmtTime = (t) => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
// Czech has three forms (1, 2–4, 5+), English two.
const plural = (n, one, few, many, enOne, enMany) => LANG === 'cs'
  ? (n === 1 ? one : n >= 2 && n <= 4 ? few : many)
  : (n === 1 ? enOne : enMany || enOne + 's');

function splitUrl(u) {
  try {
    const x = new URL(u);
    return { host: x.host, rest: x.pathname + x.search + x.hash, origin: x.origin };
  } catch (e) {
    return { host: '', rest: u, origin: '' };
  }
}
const urlCell = (u, base) => {
  const s = splitUrl(u);
  const sameHost = base && splitUrl(base).host === s.host;
  return h('span', { class: 'url', title: u }, sameHost ? null : h('span', { class: 'host' }, s.host), s.rest || '/');
};

const vpDot = (vp, on = true) => h('span', { class: `vpdot vp-${vp}${on ? '' : ' off'}`, title: VP_NAME[vp] }, VP_SHORT[vp]);

// Re-rendering replaces DOM nodes; put keyboard focus back on the equivalent node.
function keepFocus(root, fn) {
  const a = document.activeElement;
  const key = a && root.contains(a) ? (a.dataset.fk || (a.id ? '#' + a.id : '')) : '';
  fn();
  if (!key) return;
  const n = key.startsWith('#') ? document.getElementById(key.slice(1)) : [...root.querySelectorAll('[data-fk]')].find((x) => x.dataset.fk === key);
  if (n && n !== document.activeElement) n.focus({ preventScroll: true });
}

let toastTimer;
function toast(text) {
  let t = $('.toast');
  if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

async function copyText(text, msg = T('Zkopírováno do schránky', 'Copied to the clipboard')) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast(T('Kopírování selhalo: ', 'Copying failed: ') + e.message); }
}

function download(name, blobOrUrl) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function normalizeUrl(input) {
  let s = (input || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = (/^(localhost|127\.|\d+\.\d+\.\d+\.\d+|\[)/i.test(s) || /\.(test|local|localhost)(:|\/|$)/i.test(s) ? 'http://' : 'https://') + s;
  }
  if (/\s/.test(s)) return '';
  try { return new URL(s).href; } catch (e) { return ''; }
}

// ---------------------------------------------------------------- state

let settings = structuredClone(DEFAULTS);
let myTab = null;
let masterUrl = '';               // the address shown in the address bar
let projectHost = '';             // host the user loaded; notes and checklist belong to it
let leadVp = 'desktop';           // frame the user last navigated in
const navStack = { list: [], i: -1 }; // dashboard-owned back/forward history
const frameVp = new Map();        // chrome frameId -> viewport
const scrollLead = { vp: '', at: 0 }; // frame whose user input drives the joint scroll
const rt = {};                    // runtime state per viewport
const logs = new Map();           // dedup key -> entry
const net = new Map();            // requestId -> entry
let linkResults = new Map();      // url -> { status, ... }
let linkRun = null;               // { gen, done, total } while a link check runs
let linkGen = 0;                  // bumped to cancel a running link check
let notesState = { host: '', checklist: [], notes: [] };
let syncHits = [];                // times of propagated navigations (backstop against loops)
let syncPausedUntil = 0;
const els = {};                   // pane DOM per viewport
const ver = { logs: 0, net: 0, rt: 0, links: 0, notes: 0 }; // bumped on data change; tabs skip redraws when nothing changed

for (const vp of VPS) {
  rt[vp] = {
    url: '', title: '', loading: false, loadStart: 0, loadMs: null, slow: false, probe: false, awaitingHello: false,
    perf: null, audit: null, auditStale: false, isolated: false, error: '',
    cmdAt: 0,           // when the dashboard last navigated this frame
    lastInput: 0,       // last trusted pointer/key/submit in this frame (reported by the probe)
    httpStatus: 0,      // HTTP status of the frame's document when it was 4xx/5xx
    blankThen: null,    // URL to load after an about:blank hop (forces a reload of a URL with a #fragment)
    docRequestAt: 0, watchdog: 0, fallback: 0,
  };
}

const ordered = () => settings.order;  // viewports in the order the user arranged them
const visibleVps = () => ordered().filter((vp) => !settings.panes[vp].hidden);
const stripHash = (u) => String(u || '').split('#')[0];

let saveTimer;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ settings }), 250);
}

// ---------------------------------------------------------------- frame access rule

// Strip framing protection only for sub-frames inside this dashboard tab, and only while
// the dashboard is the page shown in it (removed on pagehide, here and in background.js).
async function installFrameRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [myTab.id],
    addRules: [{
      id: myTab.id,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' },
        ],
      },
      condition: { tabIds: [myTab.id], resourceTypes: ['sub_frame'] },
    }],
  });
}
const removeFrameRule = () => myTab && chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [myTab.id] }).catch(() => {});
window.addEventListener('pagehide', removeFrameRule);
window.addEventListener('pageshow', (e) => { if (e.persisted && myTab) installFrameRule(); });

// ---------------------------------------------------------------- network (webRequest)

const NET_TYPES = T({
  main_frame: 'dokument', sub_frame: 'dokument', stylesheet: 'styl', script: 'skript', image: 'obrázek',
  font: 'písmo', xmlhttprequest: 'fetch/XHR', media: 'média', websocket: 'websocket', ping: 'ping', csp_report: 'CSP', object: 'objekt', other: 'jiné',
}, {
  main_frame: 'document', sub_frame: 'document', stylesheet: 'style', script: 'script', image: 'image',
  font: 'font', xmlhttprequest: 'fetch/XHR', media: 'media', websocket: 'websocket', ping: 'ping', csp_report: 'CSP', object: 'object', other: 'other',
});
const MAX_NET = 4000;

function netVp(e) {
  if (frameVp.has(e.frameId)) return frameVp.get(e.frameId);
  if (frameVp.has(e.parentFrameId)) return frameVp.get(e.parentFrameId);
  return null;
}
// URLs that some frame loaded fine. The three frames request the same files at the same time
// and share one HTTP cache; Chromium then sometimes fails one copy with ERR_CACHE_MISS (cache
// entry locked). That is the bench, not the site, when another request got the file.
const okUrls = new Set();
const benchArtifact = (e) => e.error === 'net::ERR_CACHE_MISS' && okUrls.has(e.url);
const isNetProblem = (e) => (!!e.error && !e.aborted && !benchArtifact(e)) || e.status >= 400;

function setupWebRequest() {
  const filter = { urls: ['<all_urls>'], tabId: myTab.id };
  chrome.webRequest.onBeforeRequest.addListener((d) => {
    if (d.frameId === 0) return; // the dashboard itself (e.g. link checker)
    if (d.type === 'sub_frame' && frameVp.has(d.frameId)) {
      // A new document starts in a viewport frame: like DevTools, forget its old requests.
      const vp = frameVp.get(d.frameId);
      const r = rt[vp];
      r.docRequestAt = Date.now();
      // Decided now and kept: later clicks while the server is answering do not change it.
      // 5 s covers a click that starts a fetch and then navigates (login, then redirect).
      r.userDoc = r.lastInput > r.cmdAt && r.docRequestAt - r.lastInput < 5000;
      rt[vp].httpStatus = 0;
      if (!settings.keepLog) for (const [id, e] of net) if (netVp(e) === vp) net.delete(id);
    }
    net.set(d.requestId, {
      id: d.requestId, url: d.url, origUrl: d.url, method: d.method, type: d.type, frameId: d.frameId, parentFrameId: d.parentFrameId,
      start: d.timeStamp, end: null, status: null, error: '', size: null, cached: false, redirects: [],
    });
    if (net.size > MAX_NET) net.delete(net.keys().next().value);
    ver.net++;
    scheduleRender();
  }, filter);
  chrome.webRequest.onBeforeRedirect.addListener((d) => {
    const e = net.get(d.requestId);
    if (!e) return;
    e.redirects.push({ status: d.statusCode, from: d.url, to: d.redirectUrl });
    e.url = d.redirectUrl;
  }, filter);
  chrome.webRequest.onCompleted.addListener((d) => {
    const e = net.get(d.requestId);
    if (!e) return;
    e.end = d.timeStamp;
    e.status = d.statusCode;
    e.cached = d.fromCache;
    if (d.statusCode < 400) okUrls.add(e.url);
    const len = (d.responseHeaders || []).find((x) => x.name.toLowerCase() === 'content-length');
    if (len) e.size = +len.value;
    if (e.type === 'sub_frame' && frameVp.has(e.frameId)) { rt[frameVp.get(e.frameId)].httpStatus = e.status >= 400 ? e.status : 0; ver.rt++; }
    // Otherwise the frame is not identified yet; the status is picked up when it is (wt-hello).
    ver.net++;
    scheduleRender();
  }, filter, ['responseHeaders']);
  chrome.webRequest.onErrorOccurred.addListener((d) => {
    const e = net.get(d.requestId);
    if (!e) return;
    e.end = d.timeStamp;
    e.error = d.error;
    if (d.error === 'net::ERR_ABORTED') e.aborted = true;
    if (e.type === 'sub_frame' && !e.aborted) markFrameError(e, d.error);
    ver.net++;
    scheduleRender();
  }, filter);
}

function markFrameError(e, msg) {
  // The document request of a viewport frame failed. Before the frame's first
  // successful load we may not know its frameId yet, so fall back to the URL.
  const vp = frameVp.get(e.frameId);
  const targets = vp ? [vp] : VPS.filter((v) => rt[v].awaitingHello && stripHash(rt[v].url) === stripHash(e.origUrl) && e.parentFrameId === 0);
  for (const v of targets) {
    rt[v].error = msg;
    rt[v].probe = false; // whatever shows now is an error page without our probe
  }
  ver.rt++;
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'wt-hello' || !sender.tab || !myTab || sender.tab.id !== myTab.id) return;
  if (!VPS.includes(msg.vp)) return;
  for (const [fid, v] of frameVp) if (v === msg.vp && fid !== sender.frameId) frameVp.delete(fid);
  frameVp.set(sender.frameId, msg.vp);
  // The document request may have completed before the frame was identified (first load, redirects).
  let doc = null;
  for (const e of net.values()) if (e.type === 'sub_frame' && e.frameId === sender.frameId && (!doc || e.start >= doc.start)) doc = e;
  if (doc && doc.status !== null) { rt[msg.vp].httpStatus = doc.status >= 400 ? doc.status : 0; ver.rt++; }
  ver.net++;
  scheduleRender();
});

// ---------------------------------------------------------------- messages from frames

function vpBySource(src) {
  for (const vp of VPS) if (els[vp] && els[vp].iframe.contentWindow === src) return vp;
  return null;
}

function postCmd(vp, cmd, data = {}) {
  const w = els[vp] && els[vp].iframe.contentWindow;
  if (w) w.postMessage({ __wtcmd: 1, cmd, ...data }, '*');
}

// Frames run arbitrary page code, so everything they send is checked before use.
const isArr = Array.isArray;
const isObj = (o) => o && typeof o === 'object' && !isArr(o);
function validAudit(a) {
  return isObj(a) && isObj(a.page) && isObj(a.issues) && isArr(a.headings) && isArr(a.links) &&
    typeof a.viewportWidth === 'number' && typeof a.scrollWidth === 'number' &&
    ISSUES.every((is) => isArr(a.issues[is.key]) && a.issues[is.key].every(isObj));
}
const validPerf = (p) => isObj(p) && isArr(p.slowest) && isArr(p.largest);

window.addEventListener('message', (ev) => {
  const d = ev.data;
  if (!isObj(d) || d.__wt !== 1) return;
  const vp = vpBySource(ev.source);
  if (!vp) return;
  let origin;
  try { origin = new URL(d.url).origin; } catch (e) { return; }
  if (origin !== ev.origin || !/^https?:/.test(d.url)) return;
  const r = rt[vp];
  const title = typeof d.title === 'string' ? d.title : undefined;
  switch (d.kind) {
    case 'hello':
      if (!r.loading) startLoading(vp);
      r.probe = true;
      r.awaitingHello = false;
      r.error = '';
      if (!settings.keepLog) forgetLogs(vp);
      handleNav(vp, d.url, title, 'doc');
      break;
    case 'ready':
      if (title !== undefined) r.title = title;
      if (Object.values(settings.overlays).some(Boolean)) postCmd(vp, 'overlays', { overlays: settings.overlays });
      break;
    case 'loaded':
      if (title !== undefined) r.title = title;
      finishLoading(vp, typeof d.loadTime === 'number' ? d.loadTime : null);
      break;
    case 'nav':
      handleNav(vp, d.url, title, ['push', 'replace', 'pop', 'hash'].includes(d.navKind) ? d.navKind : 'push');
      break;
    case 'input':
      r.lastInput = Date.now();
      // Enter on a link: the request event can arrive just before the input message.
      if (!r.userDoc && r.docRequestAt > r.cmdAt && r.lastInput - r.docRequestAt < 500) r.userDoc = true;
      return;
    case 'auditError':
      r.auditError = typeof d.message === 'string' ? d.message.slice(0, 300) : T('neznámá chyba', 'unknown error');
      r.auditStale = false;
      break;
    case 'log':
      if (typeof d.message === 'string' && ['error', 'warn', 'info', 'log'].includes(d.level)) addLog(vp, d);
      break;
    case 'scroll':
      // The probe only reports scrolling the user caused, so echoes never come back here.
      if (settings.syncScroll && typeof d.ratio === 'number') {
        const loc = (l) => (isObj(l) && isArr(l.rel) ? { base: typeof l.base === 'string' ? l.base.slice(0, 200) : null, rel: l.rel.filter(Number.isInteger).slice(0, 200), sig: String(l.sig || '').slice(0, 120) } : null);
        // The frame the user touched last leads. Leftover momentum in a frame the user just
        // left must not pull the one they are scrolling now.
        const at = Number.isFinite(d.inputAt) ? d.inputAt : 0;
        if (at > scrollLead.at) Object.assign(scrollLead, { vp, at });
        else if (vp !== scrollLead.vp) return;
        const num = (v) => (Number.isFinite(+v) ? +v : 0);
        const anchor = isObj(d.anchor) && loc(d.anchor.loc) ? { loc: loc(d.anchor.loc), offset: num(d.anchor.offset), height: num(d.anchor.height) } : null;
        const edge = d.edge === 'top' || d.edge === 'bottom' ? d.edge : null;
        const dir = d.dir === 1 || d.dir === -1 ? d.dir : 0;
        for (const o of visibleVps()) {
          if (o === vp || !rt[o].probe) continue;
          postCmd(o, 'scroll', { ratio: d.ratio, edge, dir, inputAt: at, anchor, container: loc(d.container) });
        }
      }
      return;
    case 'perf':
      if (validPerf(d.perf)) {
        r.perf = d.perf;
        if (typeof d.perf.load === 'number') r.loadMs = d.perf.load; // load time without the bench's request queue
      }
      break;
    case 'audit':
      if (validAudit(d.audit)) { r.audit = d.audit; r.auditStale = false; r.auditError = ''; }
      break;
    default:
      return;
  }
  if (d.kind !== 'log') ver.rt++;
  scheduleRender();
});

function handleNav(vp, url, title, kind) {
  const r = rt[vp];
  r.url = url;
  if (title !== undefined) r.title = title;
  // Only navigations the user caused in this frame (a click, a key, a form) are propagated.
  // Redirects, scripted navigations and the dashboard's own commands are not, so frames
  // can never redirect each other back and forth.
  // A new document is the user's when its request started right after input in this frame
  // (a click, Enter, a form), however long the server then took; the input message and the
  // request event travel separately, so allow either order. Same-document changes (SPA
  // routes, #hash) count when there was input in the last seconds.
  const byUser = kind === 'doc'
    ? !!r.userDoc && r.docRequestAt > r.cmdAt
    : r.lastInput > r.cmdAt && Date.now() - r.lastInput < 5000;
  if (kind === 'doc') r.userDoc = false;
  // Browser Back/Forward (or a link to the neighbouring page) moves the lead frame to the
  // previous or next entry: step through the history instead of adding to it.
  const vis0 = visibleVps();
  const lead0 = vis0.includes(leadVp) ? leadVp : vis0[vis0.length - 1];
  const stepTo = url === navStack.list[navStack.i - 1] ? -1 : url === navStack.list[navStack.i + 1] ? 1 : 0;
  if (stepTo && kind !== 'replace' && (byUser || vp === lead0) && Date.now() - r.cmdAt > 1500 && url !== masterUrl) {
    leadVp = vp;
    navStack.i += stepTo;
    setMaster(url, 'none');
    if (settings.syncNav) for (const o of vis0) if (o !== vp && rt[o].url !== url) navigateFrame(o, url);
    return;
  }
  if (!byUser) {
    const vis = visibleVps();
    const lead = vis.includes(leadVp) ? leadVp : vis[vis.length - 1];
    if (vp !== lead || stripHash(url) === stripHash(masterUrl)) return;
    setMaster(url, 'replace'); // a redirect or scripted navigation
    return;
  }
  leadVp = vp;
  if (url === masterUrl) return;
  if (kind === 'replace') { setMaster(url, 'replace'); return; } // e.g. a search box updating ?q= – not worth reloading the others
  setMaster(url, 'push');
  if (!settings.syncNav) return;
  clearTimeout(syncTimer);
  // SPA route changes can come in bursts (a search box pushing ?q= per key): sync once they settle.
  if (kind === 'push') syncTimer = setTimeout(() => propagate(vp), 600);
  else propagate(vp);
}

let syncTimer = 0;   // debounce of SPA route bursts
let pauseTimer = 0;  // catch-up when the backstop pause ends
function propagate(vp) {
  const url = rt[vp].url;
  if (!settings.syncNav || settings.panes[vp].hidden || !/^https?:/.test(url)) return;
  const now = Date.now();
  syncHits = syncHits.filter((t) => now - t < 10000);
  if (now < syncPausedUntil) return;
  if (syncHits.length >= 8) { // backstop: a page that keeps changing its address after one action
    syncPausedUntil = now + 10000;
    toast(T('Spojená navigace na 10 s pozastavena: stránka mění adresu příliš často', 'Linked navigation paused for 10 s: the page changes its address too often'));
    // When the pause ends, bring the other frames to wherever the lead frame is then.
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      syncHits = [];
      const vis = visibleVps();
      propagate(vis.includes(leadVp) ? leadVp : vis[vis.length - 1]);
    }, 10050);
    return;
  }
  syncHits.push(now);
  for (const o of visibleVps()) if (o !== vp && rt[o].url !== url) navigateFrame(o, url);
}

function setMaster(url, mode) {
  masterUrl = url;
  if (mode === 'push' && navStack.list[navStack.i] !== url) {
    navStack.list = navStack.list.slice(0, navStack.i + 1);
    navStack.list.push(url);
    if (navStack.list.length > 60) navStack.list.shift();
    navStack.i = navStack.list.length - 1;
  } else if (mode === 'replace' && navStack.i >= 0) {
    navStack.list[navStack.i] = url;
  }
  if (document.activeElement !== els.url) els.url.value = url;
  updateAddress();
}

function goHistory(step) {
  const i = navStack.i + step;
  if (settings.syncNav && (i < 0 || i >= navStack.list.length)) return;
  if (!settings.syncNav) {
    // Frames go their own way: step back only in the frame the user last navigated in.
    const vis = visibleVps();
    const lead = vis.includes(leadVp) ? leadVp : vis[vis.length - 1];
    rt[lead].cmdAt = Date.now();
    postCmd(lead, step < 0 ? 'back' : 'forward');
    return;
  }
  navStack.i = i;
  const url = navStack.list[i];
  setMaster(url, 'none');
  for (const vp of visibleVps()) if (rt[vp].url !== url) navigateFrame(vp, url);
  scheduleRender();
}

// ---------------------------------------------------------------- logs

const MAX_LOGS = 1500;
function addLog(vp, d) {
  const str = (v) => (typeof v === 'string' ? v : '');
  const stack = str(d.stack).slice(0, 8000);
  const firstStackLine = stack.split('\n').find((l) => l.trim()) || '';
  const key = [d.level, str(d.source), d.message, firstStackLine].join('|');
  let e = logs.get(key);
  if (!e) {
    e = { key, level: d.level, source: str(d.source), message: d.message, stack, where: str(d.where), resourceUrl: str(d.resourceUrl), pageUrl: d.url, vps: new Set(), count: 0, first: d.t, last: d.t };
    logs.set(key, e);
    if (logs.size > MAX_LOGS) logs.delete(logs.keys().next().value);
  }
  e.vps.add(vp);
  e.count++;
  e.last = typeof d.t === 'number' ? d.t : Date.now();
  ver.logs++;
}

// A frame started a new document: drop what its previous page logged (unless "keep" is on).
function forgetLogs(vp) {
  for (const [k, e] of logs) {
    if (!e.vps.has(vp)) continue;
    e.vps.delete(vp);
    if (!e.vps.size) logs.delete(k);
  }
  ver.logs++;
}

function logCounts(vp) {
  let err = 0, warn = 0;
  for (const e of logs.values()) {
    if (vp && !e.vps.has(vp)) continue;
    if (e.level === 'error') err++;
    else if (e.level === 'warn') warn++;
  }
  return { err, warn };
}

function clearData() {
  logs.clear();
  net.clear();
  okUrls.clear();
  linkResults = new Map();
  linkGen++;
  linkRun = null;
  ver.logs++; ver.net++; ver.links++;
}

// ---------------------------------------------------------------- loading

function updateAddress() {
  const s = splitUrl(masterUrl);
  document.title = s.host ? s.host + ' – Web Test Bench' : 'Web Test Bench';
  const q = masterUrl ? '?url=' + encodeURIComponent(masterUrl) : '';
  history.replaceState(null, '', location.pathname + q);
  // With sync off, Back/Forward act on the lead frame's own history, which the dashboard cannot see.
  els.back.disabled = settings.syncNav && navStack.i <= 0;
  els.fwd.disabled = settings.syncNav && navStack.i >= navStack.list.length - 1;
}

function loadUrl(raw) {
  const url = normalizeUrl(raw);
  if (!url) { toast(T('Tohle není platná adresa', 'This is not a valid address')); return; }
  if (!/^https?:/.test(url)) { toast(T('Panel umí testovat jen stránky na http a https', 'The bench can only test http and https pages')); return; }
  settings.history = [url, ...settings.history.filter((u) => u !== url)].slice(0, 25);
  saveSettings();
  renderHistory();
  if (!settings.keepLog) clearData();
  const host = splitUrl(url).host;
  if (host !== projectHost) { projectHost = host; loadNotes(host); }
  setMaster(url, 'push');
  renderStage();
  for (const vp of visibleVps()) startLoading(vp); // report() and isReady() must not show the previous page meanwhile
  // Let the frames get their final size before the page starts, so scripts that read innerWidth while parsing see the right width.
  afterLayout(() => { for (const vp of visibleVps()) navigateFrame(vp, url, { force: true }); scheduleRender(); });
}

// Two animation frames let layout settle; the timeout covers background tabs, where rAF does not run.
const afterLayout = (fn) => {
  let done = false;
  const go = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 200);
};

function startLoading(vp, isolated = false) {
  const r = rt[vp];
  Object.assign(r, { loading: true, loadStart: performance.now(), loadMs: null, slow: false, perf: null, audit: null, auditStale: false, auditError: '', error: '', isolated, awaitingHello: true });
  clearTimeout(r.watchdog);
  r.watchdog = setTimeout(() => {
    if (!r.loading) return;
    Object.assign(r, { loading: false, awaitingHello: false, slow: true });
    measureNow(vp); // the load event never came: measure what is there
    ver.rt++;
    scheduleRender();
  }, 30000);
  ver.rt++;
}

// Ask a frame that has the probe for metrics and a page check right now (used when load never fires).
function measureNow(vp) {
  if (!rt[vp].probe) return;
  postCmd(vp, 'perf');
  postCmd(vp, 'audit');
}

function finishLoading(vp, frameLoadMs) {
  const r = rt[vp];
  if (!r.loading && r.loadMs !== null) return;
  clearTimeout(r.watchdog);
  r.loading = false;
  r.awaitingHello = false;
  r.slow = false;
  // The frame's own Navigation Timing is comparable between frames; the dashboard's clock is the fallback.
  r.loadMs = frameLoadMs !== null ? frameLoadMs : performance.now() - r.loadStart;
  ver.rt++;
}

// Navigate one frame. Same-document changes (only the #fragment differs) do not reload.
function navigateFrame(vp, url, { force = false } = {}) {
  if (!/^https?:/.test(url)) return; // never load anything but web pages (e.g. an empty URL would load the dashboard itself)
  const r = rt[vp];
  const prev = r.url;
  r.cmdAt = Date.now();
  r.httpStatus = 0;
  if (!force && r.probe && !r.loading && prev && url !== prev && url.includes('#') && stripHash(url) === stripHash(prev)) {
    r.url = url;
    postCmd(vp, 'navigate', { href: url });
    ver.rt++;
    return;
  }
  r.url = url;
  startLoading(vp);
  setFrameSrc(vp, url, prev);
}

// Programmatic navigations replace the frame's history entry instead of adding one: the tab's
// joint history then only holds the user's own clicks, so the browser's Back button steps
// through them one at a time (and the dashboard re-syncs the other frames).
function frameGo(fr, url) {
  try {
    if (fr.contentWindow && fr.getAttribute('src')) { fr.contentWindow.location.replace(url); return; }
  } catch (e) { /* fall back to src */ }
  fr.src = url;
}

function setFrameSrc(vp, url, prev) {
  const r = rt[vp];
  const fr = els[vp].iframe;
  r.probe = false;
  clearTimeout(r.fallback);
  // Loading the current URL plus a #fragment would only scroll, not load: hop through about:blank.
  if (url.includes('#') && prev && stripHash(prev) === stripHash(url)) {
    r.blankThen = url;
    frameGo(fr, 'about:blank');
  } else {
    r.blankThen = null;
    frameGo(fr, url);
  }
}

function reloadFrame(vp, isolated = false) {
  const r = rt[vp];
  if (!r.url) return;
  r.cmdAt = Date.now();
  r.httpStatus = 0;
  const hadProbe = r.probe;
  const asked = Date.now();
  startLoading(vp, isolated);
  if (hadProbe) {
    // location.reload() revalidates the cache like F5; if no new document starts, fall back to src.
    postCmd(vp, 'reload');
    clearTimeout(r.fallback);
    r.fallback = setTimeout(() => { if (r.awaitingHello && r.docRequestAt < asked) setFrameSrc(vp, r.url, r.url); }, 1500);
  } else {
    setFrameSrc(vp, r.url, r.url);
  }
}

function reloadAll() {
  if (!masterUrl) return;
  if (!settings.keepLog) clearData();
  for (const vp of visibleVps()) {
    if (rt[vp].url) reloadFrame(vp);
    else navigateFrame(vp, masterUrl, { force: true });
  }
  scheduleRender();
}

// ---------------------------------------------------------------- stage & panes

function presetOf(id) { return PRESETS.find((p) => p.id === id); }

function computeScale() {
  if (settings.zoom !== 'fit') return +settings.zoom;
  const vis = visibleVps();
  if (!vis.length) return 1;
  const st = els.stage;
  const avail = st.clientWidth - 48 - 32 * (vis.length - 1);
  const need = (s) => vis.reduce((sum, vp) => sum + Math.max(Math.round(settings.panes[vp].w * s), MIN_PANE), 0);
  let s = Math.min(1, Math.floor((avail / vis.reduce((sum, vp) => sum + settings.panes[vp].w, 0)) * 100) / 100);
  while (s > 0.15 && need(s) > avail) s = Math.round((s - 0.01) * 100) / 100;
  return Math.max(0.15, s);
}
const MIN_PANE = 236;

function buildPane(vp) {
  const p = settings.panes[vp];
  const e = {};
  e.wIn = h('input', { type: 'number', min: 200, max: 3840, value: p.w, 'aria-label': T(`Šířka – ${VP_NAME[vp]}`, `Width – ${VP_NAME[vp]}`), title: T('Šířka v CSS pixelech', 'Width in CSS pixels') });
  e.hIn = h('input', { type: 'number', min: 200, max: 4000, value: p.h, class: 'h', 'aria-label': T(`Výška – ${VP_NAME[vp]}`, `Height – ${VP_NAME[vp]}`), title: T('Výška v CSS pixelech', 'Height in CSS pixels') });
  const onSize = () => {
    const w = Math.max(200, Math.min(3840, +e.wIn.value || p.w));
    const hh = Math.max(200, Math.min(4000, +e.hIn.value || p.h));
    Object.assign(p, { w, h: hh, preset: 'custom' });
    saveSettings();
    renderStage();
  };
  e.wIn.addEventListener('change', onSize);
  for (const inp of [e.wIn, e.hIn]) inp.addEventListener('input', () => { inp.style.width = Math.max(3, String(inp.value).length) + 0.6 + 'ch'; });
  e.hIn.addEventListener('change', onSize);

  e.preset = h('select', { class: 'preset', 'aria-label': T(`Zařízení – ${VP_NAME[vp]}`, `Device – ${VP_NAME[vp]}`) });
  const groups = {};
  for (const pr of PRESETS) {
    if (!groups[pr.group]) { groups[pr.group] = h('optgroup', { label: pr.group }); e.preset.append(groups[pr.group]); }
    groups[pr.group].append(h('option', { value: pr.id }, `${pr.name} · ${pr.w}×${pr.h}`));
  }
  e.preset.append(h('option', { value: 'custom' }, T('Vlastní velikost', 'Custom size')));
  e.preset.addEventListener('change', () => {
    const pr = presetOf(e.preset.value);
    if (pr) Object.assign(p, { preset: pr.id, w: pr.w, h: pr.h });
    else p.preset = 'custom';
    saveSettings();
    renderStage();
  });

  e.status = h('span', { class: 'pane-status' });
  e.badges = h('span', { class: 'vps' });
  e.iframe = makeFrame(vp);
  e.loadbar = h('div', { class: 'loadbar', hidden: true });
  e.device = h('div', { class: 'device' }, e.loadbar, e.iframe);
  e.flags = h('span', { class: 'pane-flags' });

  const btn = (icon, title, fn) => h('button', { type: 'button', class: 'ibtn', title, 'aria-label': title, html: svg(icon), onclick: fn });
  e.root = h('section', { class: `pane vp-${vp}`, 'aria-label': VP_NAME[vp] },
    h('div', { class: 'pane-head' },
      h('span', { class: 'pane-name' }, VP_NAME[vp]),
      h('span', { class: 'ph-size' }, e.wIn, h('span', { class: 'x' }, '×'), e.hIn),
      e.preset,
      h('span', { class: 'ph-status' }, e.status, e.badges),
    ),
    e.device,
    h('div', { class: 'pane-foot' }, e.flags,
      h('span', { class: 'pane-actions' },
      btn('rotate', T('Otočit na šířku / na výšku', 'Rotate to landscape / portrait'), () => { Object.assign(p, { w: p.h, h: p.w }); saveSettings(); renderStage(); }),
      btn('reload', T('Načíst znovu jen tento rám', 'Reload only this frame'), () => reloadFrame(vp)),
      btn('external', T('Otevřít aktuální adresu v nové záložce', 'Open the current address in a new tab'), () => rt[vp].url && chrome.tabs.create({ url: rt[vp].url, index: myTab.index + 1 })),
      btn('camera', T('Uložit snímek tohoto rámu', 'Save a screenshot of this frame'), () => screenshot(e.device, `${vp}-${p.w}x${p.h}`)))),
  );
  els[vp] = e;
}

// The probe reads its options from the frame name: mobile User-Agent and the language of its messages.
const frameName = (vp) => `wt-${vp}${settings.mobileUA && vp !== 'desktop' ? '-ua' : ''}-${LANG}`;

function makeFrame(vp) {
  const fr = h('iframe', {
    name: frameName(vp),
    title: T(`Náhled – ${VP_NAME[vp]}`, `Preview – ${VP_NAME[vp]}`),
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock allow-presentation',
    allow: 'clipboard-write; fullscreen; autoplay; encrypted-media; picture-in-picture; geolocation',
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
  fr.addEventListener('load', () => {
    const r = rt[vp];
    if (r.blankThen) { const u = r.blankThen; r.blankThen = null; frameGo(fr, u); return; }
    if (!r.loading) return;
    // Tiny or cached pages can fire load before their hello message is handled; wait a moment.
    setTimeout(() => {
      if (!r.loading) return;
      if (r.awaitingHello) r.probe = false; // no probe in this document (error page, PDF, blocked frame…)
      finishLoading(vp, null);
      scheduleRender();
    }, 400);
  });
  return fr;
}

// The frame name carries the per-frame options, and a name only applies to new frames.
function recreateFrame(vp) {
  const e = els[vp];
  const fresh = makeFrame(vp);
  e.iframe.replaceWith(fresh);
  e.iframe = fresh;
  for (const [fid, v] of frameVp) if (v === vp) frameVp.delete(fid);
  Object.assign(rt[vp], { probe: false, url: '' });
  renderStage();
}

function renderStage() {
  const st = els.stage;
  const vis = visibleVps();
  if (!masterUrl) {
    if (!$('.stage-empty', st)) {
      st.replaceChildren(h('div', { class: 'stage-empty' },
        h('h2', null, T('Zadej adresu stránky nahoře', 'Enter a page address above')),
        h('p', null, T('Stránka se otevře ve třech velikostech vedle sebe. Chyby, síť, rychlost a kontrolu najdeš v panelu dole.', 'The page opens at three sizes side by side. Errors, network, speed and the page check are in the panel below.')),
        h('p', { class: 'note' }, T('Tip: tlačítko rozšíření na liště (Alt+Shift+T) otevře panel rovnou s aktuální stránkou.', 'Tip: the extension button in the toolbar (Alt+Shift+T) opens the bench with the current page.'))));
    }
    return;
  }
  $('.stage-empty', st)?.remove();
  if (!els.mobile.root.isConnected) st.append(...VPS.map((vp) => els[vp].root));
  const s = computeScale();
  for (const vp of VPS) {
    const e = els[vp];
    const p = settings.panes[vp];
    if (p.hidden) { e.root.hidden = true; continue; }
    e.root.hidden = false;
    e.iframe.style.width = p.w + 'px';
    e.iframe.style.height = p.h + 'px';
    // transform keeps the page's real CSS width and devicePixelRatio (CSS zoom would not:
    // the page then reads a wrong innerWidth while parsing).
    e.iframe.style.transform = s === 1 ? '' : `scale(${s})`;
    e.device.style.width = Math.round(p.w * s) + 'px';
    e.device.style.height = Math.round(p.h * s) + 'px';
    e.root.style.width = Math.max(Math.round(p.w * s), MIN_PANE) + 'px';
    if (e.scale !== undefined && (e.lastW !== p.w || e.lastH !== p.h) && rt[vp].audit) rt[vp].auditStale = true; // the frame re-checks itself after resizing
    e.lastW = p.w; e.lastH = p.h;
    if (document.activeElement !== e.wIn) e.wIn.value = p.w;
    if (document.activeElement !== e.hIn) e.hIn.value = p.h;
    for (const inp of [e.wIn, e.hIn]) inp.style.width = Math.max(3, String(inp.value).length) + 0.6 + 'ch';
    e.preset.value = presetOf(p.preset) ? p.preset : 'custom';
    e.preset.title = (presetOf(p.preset)?.name || T('Vlastní velikost', 'Custom size')) + T(' – vybrat zařízení', ' – choose a device');
    e.scale = s;
  }
  // Centre with a whole-pixel offset: flex centring can put frames on half pixels, and a
  // scaled frame on a half pixel renders its text blurry.
  const used = vis.reduce((sum, vp) => sum + Math.max(Math.round(settings.panes[vp].w * s), MIN_PANE), 0) + 32 * (vis.length - 1);
  const free = st.clientWidth - 48 - used;
  for (const vp of VPS) { els[vp].root.style.marginLeft = ''; els[vp].root.style.order = String(ordered().indexOf(vp)); }
  if (vis.length) els[vis[0]].root.style.marginLeft = Math.max(0, Math.floor(free / 2)) + 'px';
  // The scale is shown once, in the zoom menu, instead of under every frame.
  const fitOpt = $('#zoom option[value="fit"]');
  if (fitOpt) fitOpt.textContent = settings.zoom === 'fit' && vis.length ? `Auto ${nf0.format(s * 100)} %` : T('Přizpůsobit', 'Fit');
  $('#zoom').title = T('Měřítko náhledů', 'Preview zoom') + (settings.zoom === 'fit' ? T(': přizpůsobí se šířce okna', ': fits the window width') : '');
  renderPanes();
}

function renderPanes() {
  document.body.dataset.wtReady = String(isReady()); // for scripts and AI agents waiting on the bench
  for (const vp of VPS) {
    const e = els[vp];
    const r = rt[vp];
    if (!e || settings.panes[vp].hidden) continue;
    e.loadbar.hidden = !r.loading;
    e.status.textContent = r.loading ? T('Načítá…', 'Loading…') : r.slow ? T('přes 30 s', 'over 30 s') : r.loadMs !== null ? fmtMs(r.loadMs) : '';
    e.status.title = r.slow ? T('Stránka se nenačetla do 30 sekund', 'The page did not load within 30 seconds') : r.loadMs !== null ? T('Doba do události load podle Navigation Timing rámu', 'Time to the load event, from the frame\'s Navigation Timing') : '';
    const c = logCounts(vp);
    const b = [];
    if (c.err) b.push(h('button', { type: 'button', class: 'badge err', title: `${c.err} ${plural(c.err, 'chyba', 'chyby', 'chyb', 'error')} ${T('v konzoli', 'in the console')}`, onclick: () => openConsoleFor(vp, 'error') }, c.err));
    if (c.warn) b.push(h('button', { type: 'button', class: 'badge warn', title: `${c.warn} ${plural(c.warn, 'varování', 'varování', 'varování', 'warning')}`, onclick: () => openConsoleFor(vp, 'warn') }, c.warn));
    e.badges.replaceChildren(...b);

    const foot = [];
    if (r.error) foot.push(h('span', { class: 'flag' }, T('Nenačteno: ', 'Not loaded: ') + r.error));
    else if (r.httpStatus) foot.push(h('span', { class: 'flag', title: T('Server vrátil pro tento dokument chybový stav', 'The server returned an error status for this document') }, 'HTTP ' + r.httpStatus));
    else if (!r.loading && r.url && !r.probe && r.loadMs !== null) {
      foot.push(h('span', { class: 'flag warn', title: T('Do rámu se nedostal měřicí skript. Bývá to chybová stránka prohlížeče, PDF, nebo web zobrazení v rámu odmítl. Zkus „Otevřít v nové záložce“.', 'The measuring script did not get into the frame. This is usually a browser error page, a PDF, or a site that refused to be framed. Try “Open in a new tab”.') }, T('Bez měření – stránka se možná nezobrazila', 'Not measured – the page may not have loaded')));
    }
    const a = r.audit;
    if (a && !r.loading) {
      const n = a.issues.overflow.length;
      const stale = r.auditStale ? ' stale' : '';
      const staleTitle = r.auditStale ? T('Platí pro předchozí velikost, nová kontrola probíhá', 'For the previous size; a new check is running') : '';
      if (a.scrollWidth > a.viewportWidth + 1) {
        foot.push(h('button', {
          type: 'button', class: 'flag' + stale, title: staleTitle || T('Ukázat prvky, které přesahují šířku obrazovky', 'Show the elements wider than the screen'),
          onclick: () => { openAuditIssue('overflow', vp); setOverlay('overflow', true); },
        }, `${T('Vodorovný posun', 'Horizontal scroll')} +${a.scrollWidth - a.viewportWidth} px${n ? ' · ' + n + ' ' + plural(n, 'prvek', 'prvky', 'prvků', 'element') : ''}`));
      } else {
        foot.push(h('span', { class: 'flag ok' + stale, title: staleTitle || null }, T('Bez vodorovného posunu', 'No horizontal scroll')));
      }
    }
    e.flags.replaceChildren(...foot);
  }
}

// ---------------------------------------------------------------- overlays

function setOverlay(name, on) {
  settings.overlays[name] = on;
  saveSettings();
  for (const b of document.querySelectorAll('[data-overlay]')) b.setAttribute('aria-pressed', String(!!settings.overlays[b.dataset.overlay]));
  for (const vp of visibleVps()) if (rt[vp].probe) postCmd(vp, 'overlays', { overlays: settings.overlays });
}

// ---------------------------------------------------------------- screenshots

async function screenshot(target, label) {
  try {
    const rect = target.getBoundingClientRect();
    const st = els.stage.getBoundingClientRect();
    const vw = window.innerWidth;
    // Only the part of the light table that is on screen; never the toolbar or the dock.
    const clip = { left: Math.max(0, st.left), top: Math.max(0, st.top), right: Math.min(vw, st.left + els.stage.clientWidth), bottom: Math.min(window.innerHeight, st.top + els.stage.clientHeight) };
    const x = Math.max(clip.left, rect.left), y = Math.max(clip.top, rect.top);
    const w = Math.min(clip.right, rect.right) - x, hgt = Math.min(clip.bottom, rect.bottom) - y;
    if (w <= 0 || hgt <= 0) { toast(T('Rám není vidět, posuň plochu', 'The frame is not visible; scroll the bench')); return; }
    const partial = target !== els.stage && (Math.round(w) < Math.round(rect.width) || Math.round(hgt) < Math.round(rect.height));
    // Hide our own floating UI (corner button, toast) for the capture.
    const floating = [$('#dockFab'), $('.toast')].filter((n) => n && !n.hidden);
    floating.forEach((n) => { n.style.visibility = 'hidden'; });
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    let dataUrl;
    try { dataUrl = await chrome.tabs.captureVisibleTab(myTab.windowId, { format: 'png' }); } finally { floating.forEach((n) => { n.style.visibility = ''; }); }
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const k = img.naturalWidth / vw;
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(hgt * k);
    c.getContext('2d').drawImage(img, x * k, y * k, w * k, hgt * k, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const host = splitUrl(masterUrl).host || 'page';
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    download(`${host}-${label}-${stamp}.png`, blob);
    toast(partial ? T('Uložena jen viditelná část rámu. Pro celý rám zvětši panel nebo posuň plochu.', 'Saved only the visible part of the frame. For the whole frame, enlarge the window or scroll the bench.') : T('Snímek uložen do Stažených souborů', 'Screenshot saved to Downloads'));
  } catch (e) {
    toast(T('Snímek se nepodařil: ', 'Screenshot failed: ') + e.message);
  }
}

// ---------------------------------------------------------------- dock tabs

const TABS = {};
let renderQueued = false;
let lastPanelRender = 0;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    try { renderPanes(); renderTabCounts(); } catch (err) { console.error('Web Test Bench render', err); }
    const now = performance.now();
    const wait = 180 - (now - lastPanelRender);
    if (wait > 0) { setTimeout(scheduleRender, wait); return; }
    lastPanelRender = now;
    const t = TABS[settings.activeTab];
    if (!t || settings.dockMode !== 'open') return;
    const sig = t.sig();
    if (sig === t.lastSig) return;
    t.lastSig = sig;
    try { t.update(); } catch (err) { console.error('Web Test Bench render', err); }
  });
}

function buildTabs() {
  const nav = $('#tabs');
  for (const [id, t] of Object.entries(TABS)) {
    t.count = h('span', { class: 'count', hidden: true });
    t.btn = h('button', { type: 'button', class: 'tab', role: 'tab', id: 'tab-' + id, 'aria-selected': 'false', onclick: () => { if (settings.dockMode !== 'open') setDockMode('open'); selectTab(id); } }, t.label, t.count);
    nav.append(t.btn);
  }
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const ids = Object.keys(TABS);
    const i = ids.indexOf(settings.activeTab) + (e.key === 'ArrowRight' ? 1 : -1);
    selectTab(ids[(i + ids.length) % ids.length]);
    TABS[settings.activeTab].btn.focus();
  });
}

function selectTab(id) {
  settings.activeTab = id;
  saveSettings();
  for (const [tid, t] of Object.entries(TABS)) {
    t.btn.setAttribute('aria-selected', String(tid === id));
    t.btn.tabIndex = tid === id ? 0 : -1;
  }
  const panel = $('#panel');
  panel.setAttribute('aria-labelledby', 'tab-' + id);
  panel.replaceChildren();
  TABS[id].mount(panel);
  TABS[id].lastSig = TABS[id].sig();
  TABS[id].update();
}

function setDockMode(mode) {
  settings.dockMode = mode;
  saveSettings();
  document.body.classList.toggle('dock-min', mode === 'min');
  document.body.classList.toggle('dock-hidden', mode === 'hidden');
  const fab = $('#dockFab');
  const min = $('#dockMin');
  fab.hidden = mode !== 'hidden';
  min.innerHTML = svg(mode === 'min' ? 'expand' : 'minimize');
  min.title = mode === 'min' ? T('Rozbalit lištu (D)', 'Expand the panel (D)') : T('Minimalizovat lištu (D)', 'Minimise the panel (D)');
  min.setAttribute('aria-label', mode === 'min' ? T('Rozbalit lištu', 'Expand the panel') : T('Minimalizovat lištu', 'Minimise the panel'));
  if (mode === 'hidden') fab.focus();
  if (mode === 'open') { const t = TABS[settings.activeTab]; t.lastSig = null; scheduleRender(); }
  if (masterUrl) renderStage();
}

function renderTabCounts() {
  const c = logCounts();
  const failedReq = netGroups(isNetProblem).length;
  const bad = c.err + failedReq;
  const fc = $('#fabCount');
  fc.textContent = bad || c.warn || '';
  fc.className = 'fab-count' + (!bad && c.warn ? ' warn' : '');
  $('#dockFab').title = T('Zobrazit lištu s výsledky (D)', 'Show the results panel (D)') + (bad ? ` – ${c.err} ${plural(c.err, 'chyba', 'chyby', 'chyb', 'error')} ${T('v konzoli', 'in the console')}, ${failedReq} ${plural(failedReq, 'neúspěšný požadavek', 'neúspěšné požadavky', 'neúspěšných požadavků', 'failed request')}` : '');
  for (const t of Object.values(TABS)) {
    const c = t.badge ? t.badge() : null;
    t.count.hidden = !c || !c.n;
    if (c && c.n) { t.count.textContent = c.n; t.count.className = 'count' + (c.cls ? ' ' + c.cls : ''); t.count.title = c.title || ''; }
  }
}

const chipToggle = (label, pressed, onclick, extra = {}) =>
  h('button', { type: 'button', class: 'chip ' + (extra.class || ''), 'aria-pressed': String(pressed), onclick, title: extra.title, 'data-fk': 'chip:' + label }, extra.dot ? h('span', { class: 'dot' }) : null, label, extra.n !== undefined ? h('span', { class: 'n' }, extra.n) : null);

function vpFilterChips(state, rerender) {
  return h('span', { class: 'seg' }, ordered().map((vp) => chipToggle(VP_NAME[vp], state[vp], () => { state[vp] = !state[vp]; rerender(); }, { class: 'vp-' + vp, dot: true })));
}

// ---- Console

const con = { levels: { error: true, warn: true, info: true, log: false }, vps: { mobile: true, tablet: true, desktop: true }, text: '', open: new Set() };

TABS.console = {
  label: T('Konzole', 'Console'),
  sig: () => ver.logs,
  badge() {
    const c = logCounts();
    return c.err ? { n: c.err, cls: 'bad', title: `${c.err} ${plural(c.err, 'různá chyba', 'různé chyby', 'různých chyb', 'distinct error')} ${T('v konzoli', 'in the console')}` }
      : c.warn ? { n: c.warn, cls: 'warn', title: `${c.warn} ${plural(c.warn, 'různé varování', 'různá varování', 'různých varování', 'distinct warning')}` } : null;
  },
  mount(panel) {
    this.levelChips = h('span', { class: 'seg' });
    this.vpChips = h('span');
    this.bar = h('div', { class: 'toolbar' },
      this.levelChips, this.vpChips,
      h('input', {
        class: 'field search', type: 'search', placeholder: T('Hledat ve zprávách', 'Search messages'), 'aria-label': T('Hledat ve zprávách', 'Search messages'), value: con.text,
        oninput: (ev) => { con.text = ev.target.value.toLowerCase(); this.update(); },
      }),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn small', onclick: () => { logs.clear(); con.open.clear(); ver.logs++; this.update(); scheduleRender(); } }, T('Vymazat', 'Clear')));
    this.list = h('div', { class: 'scroll' });
    panel.append(this.bar, this.list);
  },
  renderBar() {
    const counts = { error: 0, warn: 0, info: 0, log: 0 };
    for (const e of logs.values()) counts[e.level] = (counts[e.level] || 0) + 1;
    const levelNames = { error: T('Chyby', 'Errors'), warn: T('Varování', 'Warnings'), info: 'Info', log: 'Log' };
    keepFocus(this.bar, () => {
      this.levelChips.replaceChildren(...Object.keys(levelNames).map((l) => chipToggle(levelNames[l], con.levels[l], () => { con.levels[l] = !con.levels[l]; this.update(); }, { class: 'lvl-' + l, dot: true, n: counts[l] })));
      this.vpChips.replaceChildren(vpFilterChips(con.vps, () => this.update()));
    });
  },
  update() {
    if (!this.list || !this.list.isConnected) return;
    this.renderBar();
    const rows = [...logs.values()]
      .filter((e) => con.levels[e.level] && [...e.vps].some((v) => con.vps[v]) && (!con.text || (e.message + ' ' + e.stack + ' ' + e.resourceUrl).toLowerCase().includes(con.text)))
      .sort((a, b) => b.last - a.last)
      .slice(0, 400);
    if (!rows.length) {
      this.list.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, logs.size ? T('Filtru nic neodpovídá', 'Nothing matches the filter') : T('Konzole je čistá', 'The console is clean')),
        logs.size ? T('Zapni další úrovně nebo velikosti výše.', 'Turn on more levels or sizes above.') : masterUrl ? T('Chyby, varování a výpisy ze stránky se objeví tady.', 'Errors, warnings and logs from the page show up here.') : T('Načti stránku a sleduj, co hlásí.', 'Load a page and watch what it reports.')));
      return;
    }
    const top = this.list.scrollTop;
    keepFocus(this.list, () => this.list.replaceChildren(...rows.map((e) => this.row(e))));
    this.list.scrollTop = top;
  },
  row(e) {
    const open = con.open.has(e.key);
    const srcName = T({ console: 'console', exception: 'výjimka', promise: 'promise', resource: 'načtení zdroje', csp: 'CSP', fetch: 'síť', dialog: 'dialog', bench: 'panel' },
      { console: 'console', exception: 'exception', promise: 'promise', resource: 'resource load', csp: 'CSP', fetch: 'network', dialog: 'dialog', bench: 'bench' })[e.source] || e.source;
    const where = e.where || e.resourceUrl;
    const row = h('div', { class: 'log ' + e.level },
      h('div', { class: 'log-row', role: 'button', tabindex: 0, 'aria-expanded': String(open), 'data-fk': 'log:' + e.key,
        onclick: () => { open ? con.open.delete(e.key) : con.open.add(e.key); this.update(); },
        onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.currentTarget.click(); } } },
        h('div', { class: 'log-msg' }, e.message),
        h('div', { class: 'log-meta' },
          e.count > 1 ? h('span', { class: 'times', title: T('Počet výskytů', 'Occurrences') }, '×' + e.count) : null,
          h('span', { class: 'vps' }, ordered().map((v) => vpDot(v, e.vps.has(v)))),
          h('span', null, fmtTime(e.last))),
        h('div', { class: 'log-sub' }, h('span', { class: 'tag' }, srcName), where ? h('span', { class: 'url' }, where) : null, h('span', { title: e.pageUrl }, T('stránka ', 'page '), splitUrl(e.pageUrl).rest))));
    if (open) {
      row.append(h('div', { class: 'log-detail' },
        e.stack ? h('pre', null, e.stack) : null,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn small', html: svg('copy') + T('Kopírovat', 'Copy'), onclick: () => copyText(`${e.message}\n${e.stack || where || ''}\n${T('Stránka', 'Page')}: ${e.pageUrl}\n${T('Velikosti', 'Sizes')}: ${[...e.vps].map((v) => VP_NAME[v]).join(', ')}`) }),
          h('button', { type: 'button', class: 'btn small', onclick: () => { addNote('bug', `${T('Konzole', 'Console')}: ${e.message}`, [...e.vps].join(','), e.pageUrl); toast(T('Přidáno do poznámek', 'Added to the notes')); } }, T('Přidat do poznámek', 'Add to the notes')))));
    }
    return row;
  },
};

function openConsoleFor(vp, level) {
  for (const v of VPS) con.vps[v] = v === vp;
  if (level === 'error') { con.levels.error = true; }
  if (level === 'warn') { con.levels.warn = true; }
  selectTab('console');
}

// ---- Network

const nw = { problemsOnly: true, vps: { mobile: true, tablet: true, desktop: true }, type: '', text: '' };

const netStatus = (e) => e.error ? (e.aborted ? T('zrušeno', 'cancelled') : e.error.replace('net::', '')) : e.status === null ? '…' : String(e.status);
// Same request from several frames is one row with frame dots, like in the console.
function netGroups(filter) {
  const groups = new Map();
  for (const e of net.values()) {
    if (filter && !filter(e)) continue;
    const key = e.method + ' ' + e.url + ' ' + netStatus(e);
    let g = groups.get(key);
    if (!g) { g = { key, last: e, vps: new Set(), count: 0, first: e.start }; groups.set(key, g); }
    const vp = netVp(e);
    if (vp) g.vps.add(vp);
    g.count++;
    if (e.start >= g.last.start) g.last = e;
  }
  return [...groups.values()];
}

TABS.network = {
  label: T('Síť', 'Network'),
  sig: () => ver.net,
  badge() {
    const n = netGroups(isNetProblem).length;
    return n ? { n, cls: 'bad', title: `${n} ${plural(n, 'neúspěšný požadavek', 'neúspěšné požadavky', 'neúspěšných požadavků', 'failed request')}` } : null;
  },
  mount(panel) {
    this.bar = h('div', { class: 'toolbar' });
    this.body = h('div', { class: 'scroll' });
    panel.append(this.bar, this.body);
    const typeSel = h('select', { class: 'field', 'aria-label': T('Typ požadavku', 'Request type'), onchange: (ev) => { nw.type = ev.target.value; this.update(); } },
      h('option', { value: '' }, T('Všechny typy', 'All types')),
      [...new Set(Object.values(NET_TYPES))].map((t) => h('option', { value: t, selected: nw.type === t }, t)));
    this.problemChip = chipToggle(T('Jen problémy', 'Problems only'), nw.problemsOnly, () => { nw.problemsOnly = !nw.problemsOnly; this.problemChip.setAttribute('aria-pressed', String(nw.problemsOnly)); this.update(); }, { title: T('Jen odpovědi 4xx/5xx a požadavky, které selhaly (bez zrušených)', 'Only 4xx/5xx responses and failed requests (not cancelled ones)') });
    this.vpChips = h('span');
    this.summary = h('span', { class: 'note' });
    this.bar.append(this.problemChip, this.vpChips, typeSel,
      h('input', { class: 'field search', type: 'search', placeholder: T('Filtrovat adresy', 'Filter URLs'), 'aria-label': T('Filtrovat adresy', 'Filter URLs'), value: nw.text, oninput: (ev) => { nw.text = ev.target.value.toLowerCase(); this.update(); } }),
      h('span', { class: 'grow' }), this.summary,
      h('button', { type: 'button', class: 'btn small', onclick: () => { net.clear(); ver.net++; this.update(); scheduleRender(); } }, T('Vymazat', 'Clear')));
  },
  update() {
    if (!this.body || !this.body.isConnected) return;
    keepFocus(this.vpChips, () => this.vpChips.replaceChildren(vpFilterChips(nw.vps, () => this.update())));
    const rows = netGroups((e) => {
      const vp = netVp(e);
      if (vp && !nw.vps[vp]) return false;
      if (nw.problemsOnly && !isNetProblem(e)) return false;
      if (nw.type && NET_TYPES[e.type] !== nw.type) return false;
      if (nw.text && !e.url.toLowerCase().includes(nw.text)) return false;
      return true;
    }).sort((x, y) => y.last.start - x.last.start);
    const total = net.size;
    const problems = netGroups(isNetProblem).length;
    this.summary.textContent = `${nf0.format(total)} ${plural(total, 'požadavek', 'požadavky', 'požadavků', 'request')}, ${problems} ${plural(problems, 'problém', 'problémy', 'problémů', 'problem')}`;
    if (!rows.length) {
      this.body.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, total ? (nw.problemsOnly ? T('Žádný neúspěšný požadavek', 'No failed request') : T('Filtru nic neodpovídá', 'Nothing matches the filter')) : T('Zatím žádné požadavky', 'No requests yet')),
        total && nw.problemsOnly ? T('Všechny odpovědi jsou v pořádku. Vypni „Jen problémy“ pro celý seznam.', 'All responses are fine. Turn off “Problems only” for the full list.') : T('Požadavky stránek v rámech se zapisují tady.', 'Requests of the pages in the frames are listed here.')));
      return;
    }
    const top = this.body.scrollTop;
    this.body.replaceChildren(h('table', { class: 'grid' },
      h('thead', null, h('tr', null, h('th', null, T('Stav', 'Status')), h('th', null, T('Typ', 'Type')), h('th', null, T('Adresa', 'URL')), h('th', null, T('Rámy', 'Frames')), h('th', { class: 'num' }, T('Čas', 'Time')), h('th', { class: 'num' }, T('Velikost', 'Size')))),
      h('tbody', null, rows.slice(0, 800).map((g) => {
        const e = g.last;
        const cls = e.error ? (e.aborted || benchArtifact(e) ? 'muted' : 'bad') : e.status === null ? 'muted' : e.status >= 400 ? 'bad' : e.status >= 300 ? 'redir' : 'good';
        const redir = e.redirects.length ? e.redirects.map((r) => `${r.status} → ${r.to}`).join('\n') : '';
        return h('tr', null,
          h('td', { class: 'st ' + cls, title: redir || (benchArtifact(e) ? T('Jiný rám stejný soubor načetl; souběh v cache prohlížeče, ne chyba webu', 'Another frame loaded the same file; a race in the browser cache, not a site error') : null) }, netStatus(e), e.redirects.length ? h('span', { class: 'muted' }, ' ↪' + e.redirects.length) : null),
          h('td', { class: 'muted' }, NET_TYPES[e.type] || e.type),
          h('td', null, urlCell(e.url, masterUrl)),
          h('td', null, h('span', { class: 'vps' }, ordered().map((v) => vpDot(v, g.vps.has(v)))), g.count > g.vps.size ? h('span', { class: 'times', title: T('Počet požadavků', 'Number of requests') }, ' ×' + g.count) : null),
          h('td', { class: 'num' }, e.end ? fmtMs(e.end - e.start) : '…'),
          h('td', { class: 'num muted' }, e.cached ? 'cache' : fmtBytes(e.size)));
      }))));
    this.body.scrollTop = top;
  },
};

// ---- Performance

const METRICS = [
  { key: 'ttfb', label: 'TTFB', help: T('první bajt odpovědi (bez čekání ve frontě panelu)', 'first byte of the response (without the bench\'s queue)'), f: fmtMs, good: 800, poor: 1800 },
  { key: 'fcp', label: 'FCP', help: T('první vykreslený obsah', 'first contentful paint'), f: fmtMs, good: 1800, poor: 3000 },
  { key: 'lcp', label: 'LCP', help: T('vykreslen největší prvek', 'largest element painted'), f: fmtMs, good: 2500, poor: 4000 },
  { key: 'cls', label: 'CLS', help: T('posun rozvržení při načítání', 'layout shift while loading'), f: (v) => nf3.format(v), good: 0.1, poor: 0.25 },
  { key: 'dcl', label: 'DOMContentLoaded', help: T('HTML zpracováno', 'HTML parsed'), f: fmtMs },
  { key: 'load', label: 'Load', help: T('načteny všechny zdroje', 'all resources loaded'), f: fmtMs },
  { key: 'requests', label: T('Požadavky', 'Requests'), help: T('dokument a jeho zdroje', 'the document and its resources'), f: (v) => nf0.format(v) },
  { key: 'transfer', label: T('Přeneseno', 'Transferred'), help: T('cizí domény bez Timing-Allow-Origin se nezapočítají', 'other origins without Timing-Allow-Origin are not counted'), f: fmtBytes },
  { key: 'domNodes', label: T('Prvků v DOM', 'DOM elements'), help: T('Lighthouse varuje nad 800, chyba nad 1 400', 'Lighthouse warns above 800, errors above 1,400'), f: (v) => nf0.format(v), good: 800, poor: 1400, maxRating: 'warn' },
];
const rate = (m, v) => v === null || v === undefined || m.good === undefined ? '' : v <= m.good ? 'good' : v <= m.poor || m.maxRating === 'warn' ? 'warn' : 'bad';

const pf = { vp: 'desktop' };
TABS.perf = {
  label: T('Výkon', 'Performance'),
  sig: () => ver.rt,
  badge() {
    // Same judgement as the report: a value that only reflects the bench's request queue is not red.
    let worst = '';
    const R = masterUrl ? cachedReport() : null;
    for (const v of R ? Object.values(R.viewports) : []) {
      for (const k of ['ttfb', 'fcp', 'lcp', 'cls']) { const r = v.ratings && v.ratings[k]; if (r === 'bad') worst = 'bad'; else if (r === 'warn' && !worst) worst = 'warn'; }
    }
    return worst ? { n: worst === 'bad' ? '!' : '•', cls: worst, title: worst === 'bad' ? T('Některá metrika je špatná', 'A metric is poor') : T('Některá metrika je ke zlepšení', 'A metric needs improvement') } : null;
  },
  mount(panel) { this.body = h('div', { class: 'scroll' }); panel.append(this.body); },
  update() {
    if (!this.body || !this.body.isConnected) return;
    const vis = visibleVps();
    if (!masterUrl) { this.body.replaceChildren(h('div', { class: 'empty' }, h('strong', null, T('Zatím není co měřit', 'Nothing to measure yet')), T('Načti stránku a metriky se doplní asi 3 sekundy po události load.', 'Load a page; the metrics appear about 3 seconds after its load event.'))); return; }
    if (!vis.includes(pf.vp)) pf.vp = vis[vis.length - 1];
    const head = h('tr', null, h('th', null, T('Metrika', 'Metric')), vis.map((vp) => h('th', { class: `th-vp vp-${vp}` }, VP_NAME[vp], rt[vp].isolated ? h('span', { class: 'help' }, T('samostatně', 'alone')) : null)));
    const R = cachedReport();
    const body = METRICS.map((m) => h('tr', null,
      h('td', null, m.label, h('span', { class: 'help' }, m.help)),
      vis.map((vp) => {
        const p = rt[vp].perf;
        const v = p ? p[m.key] : null;
        const missing = v === null || v === undefined;
        const tip = m.key === 'lcp' ? (missing ? T('Prohlížeč LCP pro tento rám nenahlásil (stává se u malých stránek nebo když se obsah vykreslí ještě před sledováním).', 'The browser reported no LCP for this frame (happens with small pages or content painted before observing started).') : p.lcpEl ? T('Prvek: ', 'Element: ') + p.lcpEl : null) : null;
        const rv = R && R.viewports[vp];
        const judged = rv && rv.ratings && m.key in rv.ratings ? rv.ratings[m.key] || '' : rate(m, v);
        const queue = rv && rv.queueLimited && rv.queueLimited.includes(m.key);
        return h('td', null, p ? h('span', { class: 'mv ' + judged, title: queue ? T('Stejná věc byla v jiném rámu rychlejší; rozdíl je nejspíš čekání ve frontě panelu, hodnoceno podle něj.', 'The same thing was faster in another frame; the difference is most likely the bench\'s request queue, so it is rated by that frame.') : tip }, missing ? '–' : m.f(v), queue ? h('span', { class: 'muted' }, T(' (fronta)', ' (queue)')) : null) : h('span', { class: 'muted' }, rt[vp].loading ? T('měří se…', 'measuring…') : '–'));
      })));
    const actions = h('tr', null, h('td', null, h('span', { class: 'muted' }, T('Znovu bez ostatních rámů', 'Again without the other frames'))),
      vis.map((vp) => h('td', null, h('button', { type: 'button', class: 'btn small', disabled: !rt[vp].url || rt[vp].loading, onclick: () => reloadFrame(vp, true), title: T('Načte jen tento rám, ostatní nesoutěží o síť. Pozor: zdroje už mohou být v cache.', 'Loads only this frame, so the others do not compete for the network. Note: resources may already be cached.') }, T('Změřit znovu', 'Measure again')))));

    const p = rt[pf.vp] && rt[pf.vp].perf;
    const resTable = (title, list, valueFn) => h('div', { class: 'section' }, h('h4', null, title),
      list && list.length ? h('table', { class: 'grid' }, h('tbody', null, list.map((r) => h('tr', null, h('td', null, urlCell(r.url, masterUrl)), h('td', { class: 'muted' }, r.type), h('td', { class: 'num' }, valueFn(r)))))) : h('p', { class: 'note' }, p ? T('Žádné zdroje.', 'No resources.') : T('Čeká se na měření.', 'Waiting for the measurement.')));

    this.body.replaceChildren(h('div', { class: 'metrics' },
      h('div', null,
        h('table', { class: 'grid mtable' }, h('thead', null, head), h('tbody', null, body, actions)),
        h('p', { class: 'note', style: { margin: '8px 0 0' } }, T('Barvy podle hranic Core Web Vitals. Rámy se načítají současně a prohlížeč posílá stejné požadavky postupně; čekání dokumentu ve frontě je odečtené, u přesměrování a zdrojů ne. Přesná čísla dá „Změřit znovu“, které načte jen jeden rám.', 'Colours follow the Core Web Vitals thresholds. The frames load at the same time and the browser sends identical requests one after another; the document\'s queueing is subtracted, that of redirects and resources is not. “Measure again” loads a single frame for exact numbers.'))),
      h('div', null,
        h('div', { class: 'row', style: { marginBottom: '10px' } }, h('span', { class: 'seg-label' }, T('Zdroje pro', 'Resources for')),
          vis.map((vp) => chipToggle(VP_NAME[vp], pf.vp === vp, () => { pf.vp = vp; this.update(); }, { class: 'vp-' + vp, dot: true }))),
        resTable(T('Nejpomalejší zdroje', 'Slowest resources'), p && p.slowest, (r) => fmtMs(r.duration)),
        resTable(T('Největší zdroje', 'Largest resources'), p && p.largest.filter((r) => r.size), (r) => fmtBytes(r.size)))));
  },
};

// ---- Page check

const ISSUES = [
  { key: 'overflow', label: T('Vodorovný posun', 'Horizontal scroll'), help: T('prvky přesahují šířku obrazovky', 'elements wider than the screen'), sev: 'bad' },
  { key: 'broken', label: T('Nenačtené obrázky', 'Broken images'), sev: 'bad' },
  { key: 'mixed', label: T('Smíšený obsah', 'Mixed content'), help: T('http zdroje na https stránce', 'http resources on an https page'), sev: 'bad' },
  { key: 'smallTargets', label: T('Malé dotykové cíle', 'Small tap targets'), help: T('odkazy a tlačítka pod 24 × 24 px', 'links and buttons under 24 × 24 px'), sev: 'warn' },
  { key: 'tinyText', label: T('Drobný text', 'Tiny text'), help: T('písmo menší než 12 px', 'font smaller than 12 px'), sev: 'warn' },
  { key: 'oversized', label: T('Zbytečně velké obrázky', 'Oversized images'), help: T('zdroj víc než 2,5× širší než zobrazení', 'source more than 2.5× wider than displayed'), sev: 'warn' },
  { key: 'missingAlt', label: T('Obrázky bez alt', 'Images without alt'), sev: 'warn' },
  { key: 'unlabeled', label: T('Pole formuláře bez popisku', 'Form fields without a label'), sev: 'warn' },
  { key: 'nameless', label: T('Odkazy a tlačítka bez textu', 'Links and buttons without text'), sev: 'warn' },
  { key: 'dupIds', label: T('Duplicitní id', 'Duplicate ids'), sev: 'warn' },
  { key: 'badHref', label: T('Odkazy na # nebo javascript:', 'Links to # or javascript:'), sev: 'info' },
];
const au = { issue: null, vp: null };

function openAuditIssue(issue, vp) { au.issue = issue; au.vp = vp; selectTab('audit'); }

function pageChecks(pg) {
  const rows = [];
  // id is stable (code and the JSON report use it), k is the label shown to people.
  const add = (id, k, v, status, hint) => rows.push({ id, k, v, status, hint });
  const len = (s) => (s || '').length;
  const chars = (n) => `${n} ${T('znaků', 'characters')}`;
  add('title', T('Titulek', 'Title'), pg.title || '—', !pg.title ? 'bad' : len(pg.title) > 60 || len(pg.title) < 10 ? 'warn' : 'good',
    !pg.title ? T('Chybí <title>.', 'Missing <title>.') : chars(len(pg.title)) + (len(pg.title) > 60 ? T(', ve výsledcích hledání se zkrátí (doporučeno do 60)', ', cut off in search results (60 at most recommended)') : len(pg.title) < 10 ? T(', hodně krátký', ', very short') : ''));
  add('description', T('Popis', 'Description'), pg.description || '—', !pg.description ? 'warn' : len(pg.description) > 160 || len(pg.description) < 50 ? 'warn' : 'good',
    !pg.description ? T('Chybí meta description.', 'Missing meta description.') : chars(len(pg.description)) + (len(pg.description) > 160 ? T(', doporučeno do 160', ', 160 at most recommended') : len(pg.description) < 50 ? T(', doporučeno aspoň 50', ', at least 50 recommended') : ''));
  add('h1', T('Nadpis H1', 'H1 heading'), pg.h1 + '×', pg.h1 === 1 ? 'good' : 'warn', pg.h1 === 0 ? T('Stránka nemá H1.', 'The page has no H1.') : pg.h1 > 1 ? T('Víc H1 na stránce.', 'More than one H1.') : '');
  add('lang', T('Jazyk', 'Language'), pg.lang || '—', pg.lang ? 'good' : 'warn', pg.lang ? '' : T('Chybí atribut lang na <html>.', 'Missing lang attribute on <html>.'));
  add('viewport', 'Viewport', pg.viewport || '—', pg.viewport ? 'good' : 'bad', pg.viewport ? '' : T('Bez meta viewport se stránka na mobilu zobrazí zmenšená.', 'Without a meta viewport the page shows zoomed out on phones.'));
  add('robots', 'Robots', pg.robots || T('neuvedeno', 'not set'), /noindex/i.test(pg.robots || '') ? 'bad' : 'good', /noindex/i.test(pg.robots || '') ? T('Stránka zakazuje indexaci. Na produkci zkontroluj, že je to záměr.', 'The page forbids indexing. On production, check that this is intended.') : '');
  add('canonical', T('Kanonická URL', 'Canonical URL'), pg.canonical || '—', pg.canonical ? 'good' : 'warn', pg.canonical ? '' : T('Chybí <link rel="canonical">.', 'Missing <link rel="canonical">.'));
  add('og', T('Sdílení (OG)', 'Sharing (OG)'), pg.ogTitle || '—', pg.ogTitle && pg.ogImage ? 'good' : 'warn', !pg.ogTitle ? T('Chybí og:title.', 'Missing og:title.') : !pg.ogImage ? T('Chybí og:image.', 'Missing og:image.') : '');
  add('favicon', 'Favicon', pg.favicon ? T('ano', 'yes') : '—', pg.favicon ? 'good' : 'warn', pg.favicon ? '' : T('Chybí <link rel="icon">, prohlížeč zkusí /favicon.ico.', 'Missing <link rel="icon">; the browser will try /favicon.ico.'));
  add('structuredData', T('Strukturovaná data', 'Structured data'), pg.jsonLd ? `${pg.jsonLd}× JSON-LD` : T('žádná', 'none'), pg.jsonLd ? 'good' : '', '');
  add('charset', T('Kódování', 'Charset'), pg.charset, /utf-8/i.test(pg.charset) ? 'good' : 'warn', '');
  return rows;
}

TABS.audit = {
  label: T('Kontrola', 'Page check'),
  sig: () => ver.rt,
  badge() {
    const found = ISSUES.filter((is) => is.sev !== 'info' && visibleVps().some((vp) => rt[vp].audit && rt[vp].audit.issues[is.key].length));
    const n = found.length;
    if (!n) return null;
    return { n, cls: found.some((is) => is.sev === 'bad') ? 'bad' : 'warn', title: `${n} ${plural(n, 'druh problému', 'druhy problémů', 'druhů problémů', 'kind of problem', 'kinds of problems')} ${T('aspoň v jedné velikosti', 'in at least one size')}` };
  },
  mount(panel) {
    this.body = h('div', { class: 'scroll' });
    panel.append(h('div', { class: 'toolbar' },
      h('span', { class: 'note' }, T('Kontrola proběhne sama po načtení. Klikni na číslo pro seznam prvků, na prvek pro jeho zvýraznění v rámu.', 'The check runs by itself after loading. Click a number for the list of elements, and an element to highlight it in the frame.')),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn small', onclick: () => { for (const vp of visibleVps()) postCmd(vp, 'audit'); toast(T('Kontroluji znovu', 'Checking again')); } }, T('Zkontrolovat znovu', 'Check again'))), this.body);
  },
  update() {
    if (!this.body || !this.body.isConnected) return;
    const vis = visibleVps();
    const src = ['desktop', 'tablet', 'mobile'].find((vp) => vis.includes(vp) && rt[vp].audit);
    if (!src) {
      this.body.replaceChildren(h('div', { class: 'empty' }, h('strong', null, masterUrl ? T('Kontrola ještě neproběhla', 'The check has not run yet') : T('Není co kontrolovat', 'Nothing to check')), masterUrl ? T('Výsledky se objeví pár sekund po načtení stránky.', 'Results appear a few seconds after the page loads.') : T('Načti stránku nahoře.', 'Load a page above.')));
      return;
    }
    const a = rt[src].audit;
    const pg = a.page;

    const kv = h('div', { class: 'kv' });
    for (const r of pageChecks(pg)) {
      const v = h('div', { class: 'v' }, r.id === 'favicon' && pg.favicon ? h('img', { class: 'fav', src: pg.favicon, alt: '' }) : null, r.v, r.hint ? h('span', { class: 'hint' }, r.hint) : null);
      if (r.id === 'og' && pg.ogImage) v.append(h('img', { class: 'og-img', src: pg.ogImage, alt: 'og:image' }));
      kv.append(h('div', { class: 'k ' + r.status }, r.k), v);
    }

    const issueRows = ISSUES.map((is) => h('tr', null,
      h('td', null, is.label, is.help ? h('span', { class: 'help muted', style: { display: 'block', fontSize: '11px' } }, is.help) : null),
      vis.map((vp) => {
        const list = rt[vp].audit ? rt[vp].audit.issues[is.key] : null;
        if (!list) return h('td', { class: 'num muted' }, rt[vp].loading ? '…' : '–');
        const n = list.length;
        const active = au.issue === is.key && au.vp === vp;
        return h('td', { class: 'num' }, h('button', {
          type: 'button', class: `issue-cell ${n ? is.sev : 'zero'}${active ? ' active' : ''}`, disabled: !n,
          'aria-label': `${is.label}, ${VP_NAME[vp]}: ${n}`,
          onclick: () => { if (active) { au.issue = null; } else { au.issue = is.key; au.vp = vp; } this.update(); },
        }, n >= 40 && (is.key === 'overflow' || is.key === 'tinyText') ? '40+' : n >= 60 ? '60+' : n));
      })));

    let detail = null;
    if (au.issue && vis.includes(au.vp) && rt[au.vp].audit) {
      const is = ISSUES.find((x) => x.key === au.issue);
      const list = rt[au.vp].audit.issues[au.issue];
      detail = h('div', { class: 'section' },
        h('h4', null, `${is.label} – ${VP_NAME[au.vp]}`),
        list.length ? h('ul', { class: 'detail-list' }, list.map((it) => h('li', {
          tabindex: 0, title: T('Zvýraznit v rámu', 'Highlight in the frame'),
          onclick: () => postCmd(au.vp, 'highlight', { ref: it.ref }),
          onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); postCmd(au.vp, 'highlight', { ref: it.ref }); } },
        }, h('span', null, h('code', null, it.path || it.desc), it.text ? h('span', { class: 'muted' }, ' ' + quote(it.text)) : null), h('span', { class: 'nt' }, it.note)))) : h('p', { class: 'note' }, T('Nic k zobrazení.', 'Nothing to show.')));
    }

    let prev = 0;
    const outline = a.headings.length ? h('ul', { class: 'outline' }, a.headings.map((hd) => {
      const skip = prev && hd.level > prev + 1;
      prev = hd.level;
      const go = () => postCmd(src, 'highlight', { ref: hd.ref });
      return h('li', {
        class: (skip ? 'skip ' : '') + (hd.hidden ? 'hid' : ''), style: { paddingLeft: (hd.level - 1) * 14 + 'px' }, tabindex: 0,
        title: skip ? T('Přeskočená úroveň nadpisu', 'Skipped heading level') : hd.hidden ? T('Skrytý nadpis', 'Hidden heading') : T('Zvýraznit v rámu', 'Highlight in the frame'),
        onclick: go, onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } },
      },
        h('span', { class: 'lv' }, 'H' + hd.level), hd.text || h('em', { class: 'muted' }, T('(prázdný)', '(empty)')));
    })) : h('p', { class: 'note' }, T('Stránka nemá žádné nadpisy.', 'The page has no headings.'));

    const top = this.body.scrollTop;
    this.body.replaceChildren(h('div', { class: 'audit' },
      h('div', null,
        h('div', { class: 'section' }, h('h4', null, T('Stránka', 'Page') + ' (' + VP_NAME[src] + ')'), kv),
        h('div', { class: 'section' }, h('h4', null, T('Osnova nadpisů', 'Heading outline')), outline)),
      h('div', null,
        h('div', { class: 'section' }, h('h4', null, T('Podle velikosti', 'By size')),
          h('table', { class: 'grid mtable' },
            h('thead', null, h('tr', null, h('th', null, T('Problém', 'Problem')), vis.map((vp) => h('th', { class: `th-vp vp-${vp} num` }, VP_NAME[vp])))),
            h('tbody', null, issueRows))),
        detail)));
    this.body.scrollTop = top;
  },
};

// ---- Links

const lk = { problemsOnly: false, scope: 'all' };
const UNSAFE_LINK = /log-?out|sign-?out|odhl[aá]s|delete|remove|smazat|unsubscribe|odhlasit/i;

function collectLinks() {
  const map = new Map();
  for (const vp of VPS) {
    const a = rt[vp].audit;
    if (!a) continue;
    for (const l of a.links) {
      if (!map.has(l.url)) map.set(l.url, { ...l, vps: new Set() });
      map.get(l.url).vps.add(vp);
    }
  }
  return [...map.values()];
}

async function checkLink(url) {
  if (UNSAFE_LINK.test(url)) return { status: 'skip', note: T('přeskočeno (mohlo by odhlásit nebo mazat)', 'skipped (could log out or delete)') };
  const attempt = async (method) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const t0 = performance.now();
      const res = await fetch(url, { method, credentials: 'omit', redirect: 'follow', signal: ctl.signal, cache: 'no-store' });
      return { status: res.status, redirected: res.redirected, finalUrl: res.url, ms: performance.now() - t0 };
    } finally { clearTimeout(timer); }
  };
  try {
    let r = await attempt('HEAD');
    if ([403, 405, 501, 400].includes(r.status)) r = await attempt('GET');
    return r;
  } catch (e) {
    return { status: 'error', note: e.name === 'AbortError' ? T('vypršel čas (12 s)', 'timed out (12 s)') : e.message };
  }
}

async function runLinkCheck(links) {
  if (linkRun) return;
  const gen = ++linkGen;
  const results = linkResults; // a new page or "Zastavit" replaces linkGen; late answers then go nowhere
  linkRun = { gen, done: 0, total: links.length };
  ver.links++;
  scheduleRender();
  const queue = links.slice();
  const worker = async () => {
    while (queue.length && gen === linkGen) {
      const l = queue.shift();
      results.set(l.url, { status: 'pending' });
      const r = await checkLink(l.url);
      if (gen !== linkGen) { results.delete(l.url); return; }
      results.set(l.url, r);
      linkRun.done++;
      ver.links++;
      scheduleRender();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (gen !== linkGen) return;
  linkRun = null;
  ver.links++;
  scheduleRender();
  const bad = links.filter((l) => linkProblem(results.get(l.url))).length;
  toast(bad ? `${T('Hotovo', 'Done')}: ${bad} ${plural(bad, 'nefunkční odkaz', 'nefunkční odkazy', 'nefunkčních odkazů', 'broken link')}` : T('Hotovo: všechny odkazy fungují', 'Done: all links work'));
}
function stopLinkCheck() {
  linkGen++;
  linkRun = null;
  for (const [u, r] of linkResults) if (r.status === 'pending') linkResults.delete(u);
  ver.links++;
  scheduleRender();
}
const linkProblem = (r) => r && (r.status === 'error' || (typeof r.status === 'number' && r.status >= 400));

TABS.links = {
  label: T('Odkazy', 'Links'),
  sig: () => ver.rt + ':' + ver.links,
  badge() { let n = 0; for (const r of linkResults.values()) if (linkProblem(r)) n++; return n ? { n, cls: 'bad', title: `${n} ${plural(n, 'nefunkční odkaz', 'nefunkční odkazy', 'nefunkčních odkazů', 'broken link')}` } : null; },
  mount(panel) {
    this.bar = h('div', { class: 'toolbar' });
    this.body = h('div', { class: 'scroll' });
    panel.append(this.bar, this.body);
  },
  update() {
    if (!this.body || !this.body.isConnected) return;
    const links = collectLinks();
    const scoped = links.filter((l) => lk.scope === 'all' || (lk.scope === 'internal') === l.internal);
    const internal = links.filter((l) => l.internal).length;
    this.bar.replaceChildren(
      linkRun
        ? h('span', { class: 'row' }, h('span', { class: 'note', role: 'status' }, T(`Kontroluji ${linkRun.done} z ${linkRun.total}`, `Checking ${linkRun.done} of ${linkRun.total}`)), h('button', { type: 'button', class: 'btn small', onclick: stopLinkCheck }, T('Zastavit', 'Stop')))
        : h('button', { type: 'button', class: 'btn small primary', disabled: !scoped.length, onclick: () => runLinkCheck(scoped) }, `${T('Zkontrolovat', 'Check')} ${scoped.length} ${plural(scoped.length, 'odkaz', 'odkazy', 'odkazů', 'link')}`),
      h('span', { class: 'seg' },
        chipToggle(T('Všechny', 'All'), lk.scope === 'all', () => { lk.scope = 'all'; this.update(); }, { n: links.length }),
        chipToggle(T('Interní', 'Internal'), lk.scope === 'internal', () => { lk.scope = 'internal'; this.update(); }, { n: internal }),
        chipToggle(T('Externí', 'External'), lk.scope === 'external', () => { lk.scope = 'external'; this.update(); }, { n: links.length - internal })),
      chipToggle(T('Jen problémy', 'Problems only'), lk.problemsOnly, () => { lk.problemsOnly = !lk.problemsOnly; this.update(); }),
      h('span', { class: 'grow' }),
      h('span', { class: 'note' }, T('Ověřuje se bez cookies; odkazy na odhlášení a mazání se přeskočí.', 'Checked without cookies; logout and delete links are skipped.')));
    if (!links.length) {
      this.body.replaceChildren(h('div', { class: 'empty' }, h('strong', null, T('Žádné odkazy', 'No links')), masterUrl ? T('Odkazy se sesbírají při kontrole stránky po načtení.', 'Links are collected by the page check after loading.') : T('Načti stránku nahoře.', 'Load a page above.')));
      return;
    }
    const rank = (l) => { const r = linkResults.get(l.url); return linkProblem(r) ? 0 : r && r.redirected ? 1 : r ? 2 : 3; };
    const rows = scoped.filter((l) => !lk.problemsOnly || linkProblem(linkResults.get(l.url))).sort((a, b) => rank(a) - rank(b));
    const top = this.body.scrollTop;
    this.body.replaceChildren(rows.length ? h('table', { class: 'grid' },
      h('thead', null, h('tr', null, h('th', null, T('Stav', 'Status')), h('th', null, T('Adresa', 'URL')), h('th', null, T('Text odkazu', 'Link text')), h('th', null, T('Kde', 'Where')), h('th', { class: 'num' }, T('Čas', 'Time')))),
      h('tbody', null, rows.map((l) => {
        const r = linkResults.get(l.url);
        let st = '–', cls = 'muted', note = '';
        if (r) {
          if (r.status === 'pending') st = '…';
          else if (r.status === 'skip') { st = T('přeskočeno', 'skipped'); note = r.note; }
          else if (r.status === 'error') { st = T('chyba', 'error'); cls = 'bad'; note = r.note; }
          else { st = String(r.status); cls = r.status >= 400 ? 'bad' : r.redirected ? 'redir' : 'good'; if (r.redirected) note = '→ ' + r.finalUrl; }
        }
        return h('tr', null,
          h('td', { class: 'st ' + cls }, st),
          h('td', null, urlCell(l.url, masterUrl), note ? h('div', { class: 'note url' }, note) : null),
          h('td', null, l.text || h('span', { class: 'muted' }, T('(bez textu)', '(no text)'))),
          h('td', null, h('span', { class: 'vps' }, ordered().map((v) => vpDot(v, l.vps.has(v))))),
          h('td', { class: 'num muted' }, r && r.ms ? fmtMs(r.ms) : ''));
      }))) : h('div', { class: 'empty' }, h('strong', null, T('Žádný problém', 'No problem')), T('Mezi zkontrolovanými odkazy není žádný nefunkční.', 'None of the checked links is broken.')));
    this.body.scrollTop = top;
  },
};

// ---- Notes & checklist

async function loadNotes(host) {
  const key = 'notes:' + host;
  const data = (await chrome.storage.local.get(key))[key];
  // An untouched default list follows the interface language.
  const checklist = data?.checklist && !isDefaultChecklist(data.checklist) ? data.checklist : DEFAULT_CHECKLIST.map((text) => ({ text, done: false }));
  notesState = { host, checklist, notes: data?.notes || [] };
  ver.notes++;
  scheduleRender();
}
function saveNotes() {
  ver.notes++;
  if (!notesState.host) return;
  chrome.storage.local.set({ ['notes:' + notesState.host]: { checklist: notesState.checklist, notes: notesState.notes } });
}
function addNote(kind, text, vps, url) {
  if (!notesState.host) return;
  notesState.notes.unshift({ id: Date.now() + Math.random(), kind, text, vps, url: url || masterUrl, t: Date.now() });
  saveNotes();
  scheduleRender();
}

const RESET_ASK = T('Opravdu nahradit? Klikni znovu', 'Replace the list? Click again');
const RESET_LABEL = T('Obnovit výchozí seznam', 'Reset to the default list');
const NOTE_KIND = { bug: T('Chyba', 'Bug'), idea: T('Postřeh', 'Idea'), ok: T('V pořádku', 'OK') };

TABS.notes = {
  label: T('Poznámky', 'Notes'),
  sig: () => ver.notes,
  badge() { const n = notesState.notes.filter((x) => x.kind === 'bug').length; return n ? { n, cls: 'warn', title: `${n} ${plural(n, 'zapsaná chyba', 'zapsané chyby', 'zapsaných chyb', 'noted bug')}` } : null; },
  mount(panel) {
    this.body = h('div', { class: 'scroll' });
    this.text = h('textarea', { class: 'field', id: 'noteText', placeholder: T('Co jsi našel? Např. „Na mobilu se menu po kliknutí nezavře.“', 'What did you find? E.g. “On mobile the menu does not close after a click.”'), 'aria-label': T('Text poznámky', 'Note text') });
    this.kind = h('select', { class: 'field', 'aria-label': T('Druh poznámky', 'Kind of note') }, h('option', { value: 'bug' }, NOTE_KIND.bug), h('option', { value: 'idea' }, NOTE_KIND.idea), h('option', { value: 'ok' }, NOTE_KIND.ok));
    this.vpSel = h('select', { class: 'field', 'aria-label': T('Týká se velikosti', 'Concerns the size') }, h('option', { value: '' }, T('Všechny velikosti', 'All sizes')), ordered().map((vp) => h('option', { value: vp }, VP_NAME[vp])));
    this.newItem = h('input', { class: 'field grow', id: 'newItem', placeholder: T('Přidat bod do seznamu', 'Add an item to the list'), 'aria-label': T('Nový bod kontrolního seznamu', 'New checklist item') });
    this.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.submit(); });
    this.newItem.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addItem(); });
    panel.append(this.body);
  },
  submit() {
    const t = this.text.value.trim();
    if (!t) { this.text.focus(); return; }
    addNote(this.kind.value, t, this.vpSel.value, masterUrl);
    this.text.value = '';
    this.text.focus();
  },
  addItem() {
    const t = this.newItem.value.trim();
    if (!t) return;
    notesState.checklist.push({ text: t, done: false });
    this.newItem.value = '';
    saveNotes();
    this.update();
    this.newItem.focus();
  },
  update() {
    if (!this.body || !this.body.isConnected) return;
    if (!notesState.host) { this.body.replaceChildren(h('div', { class: 'empty' }, h('strong', null, T('Poznámky se ukládají ke každému webu zvlášť', 'Notes are kept for each site separately')), T('Načti stránku a můžeš si odškrtávat kontrolní seznam a zapisovat nálezy.', 'Load a page to tick off the checklist and write down findings.'))); return; }
    const cl = notesState.checklist;
    const done = cl.filter((c) => c.done).length;
    const kindName = NOTE_KIND;
    const top = this.body.scrollTop;
    keepFocus(this.body, () => this.body.replaceChildren(h('div', { class: 'notes' },
      h('div', null,
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          h('h4', { style: { margin: 0 } }, T(`Kontrolní seznam pro ${notesState.host}`, `Checklist for ${notesState.host}`)),
          h('span', { class: 'note' }, T(`${done} z ${cl.length}`, `${done} of ${cl.length}`))),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': cl.length, 'aria-valuenow': done }, h('i', { style: { width: (cl.length ? (done / cl.length) * 100 : 0) + '%' } })),
        h('ul', { class: 'checklist' }, cl.map((c, i) => {
          const id = 'chk-' + i;
          return h('li', { class: c.done ? 'done' : '' },
            h('input', { type: 'checkbox', id, checked: c.done, onchange: (e) => { c.done = e.target.checked; saveNotes(); this.update(); } }),
            h('label', { for: id }, c.text),
            h('button', { type: 'button', class: 'ibtn', title: T('Odebrat bod', 'Remove item'), 'aria-label': T('Odebrat bod: ', 'Remove item: ') + c.text, html: svg('close'), onclick: () => { cl.splice(i, 1); saveNotes(); this.update(); } }));
        })),
        h('div', { class: 'row' }, this.newItem, h('button', { type: 'button', class: 'btn small', onclick: () => this.addItem() }, T('Přidat', 'Add'))),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          h('button', { type: 'button', class: 'btn small', onclick: () => { cl.forEach((c) => { c.done = false; }); saveNotes(); this.update(); } }, T('Zrušit zaškrtnutí', 'Uncheck all')),
          this.resetBtn = h('button', {
            type: 'button', class: 'btn small', 'data-fk': 'reset-checklist',
            onclick: () => {
              // Two-step: the first click asks, the second within 4 s replaces the list.
              if (!this.confirmReset) {
                this.confirmReset = true;
                this.resetBtn.textContent = RESET_ASK;
                clearTimeout(this.resetTimer);
                this.resetTimer = setTimeout(() => { this.confirmReset = false; if (this.resetBtn) this.resetBtn.textContent = RESET_LABEL; }, 4000);
                return;
              }
              this.confirmReset = false;
              notesState.checklist = DEFAULT_CHECKLIST.map((text) => ({ text, done: false }));
              saveNotes();
              this.update();
              toast(T('Kontrolní seznam obnoven', 'Checklist reset'));
            },
          }, this.confirmReset ? RESET_ASK : RESET_LABEL))),
      h('div', null,
        h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } },
          h('h4', { style: { margin: 0 } }, T('Nálezy', 'Findings')),
          h('span', { class: 'row' },
            h('button', { type: 'button', class: 'btn small', html: svg('copy') + T('Kopírovat zprávu', 'Copy report'), title: T('Markdown se seznamem, poznámkami, chybami, sítí a výkonem', 'Markdown with the checklist, notes, errors, network and performance'), onclick: () => copyText(reportMarkdown(), T('Zpráva v Markdownu je ve schránce', 'Markdown report copied')) }),
            h('button', { type: 'button', class: 'btn small', onclick: () => download(`test-${notesState.host}-${new Date().toISOString().slice(0, 10)}.md`, new Blob([reportMarkdown()], { type: 'text/markdown' })) }, T('Stáhnout .md', 'Download .md')))),
        this.text,
        h('div', { class: 'row', style: { marginTop: '6px' } }, this.kind, this.vpSel, h('span', { class: 'grow', style: { flex: 1 } }), h('span', { class: 'note' }, 'Ctrl+Enter'), h('button', { type: 'button', class: 'btn small primary', onclick: () => this.submit() }, T('Uložit poznámku', 'Save note'))),
        notesState.notes.length ? h('ul', { class: 'notelist' }, notesState.notes.map((n) => h('li', null,
          h('span', { class: 'kind ' + n.kind }, kindName[n.kind]),
          h('span', { class: 'txt' }, n.text),
          h('button', { type: 'button', class: 'ibtn', title: T('Smazat poznámku', 'Delete note'), 'aria-label': T('Smazat poznámku', 'Delete note'), html: svg('close'), onclick: () => { notesState.notes = notesState.notes.filter((x) => x.id !== n.id); saveNotes(); this.update(); } }),
          h('span', { class: 'meta' }, `${new Date(n.t).toLocaleString(LOCALE)} · ${n.vps ? n.vps.split(',').map((v) => VP_NAME[v] || v).join(', ') : T('všechny velikosti', 'all sizes')} · ${splitUrl(n.url).rest || n.url}`)))) : h('p', { class: 'note', style: { marginTop: '12px' } }, T('Zatím žádné nálezy. Chybu z konzole přidáš i tlačítkem „Přidat do poznámek“ u zprávy.', 'No findings yet. You can also add a console error with “Add to the notes” on the message.'))))));
    this.body.scrollTop = top;
  },
};

// ---------------------------------------------------------------- report (for people and AI)

// Everything the bench knows, as plain data. An AI agent reads this instead of taking
// screenshots at three sizes and watching DevTools: window.webTestBench.report().
function isReady() {
  const vis = visibleVps();
  return !!masterUrl && vis.length > 0 && vis.every((vp) => {
    const r = rt[vp];
    if (!r.url || r.loading) return false;
    if (r.error || !r.probe) return true;
    return !!(r.perf && (r.audit || r.auditError) && !r.auditStale);
  });
}

// The report is rebuilt only when the data changed (the UI asks for it on every render).
let reportCache = { sig: '', R: null };
function cachedReport() {
  const sig = [ver.rt, ver.logs, ver.net, ver.links, ver.notes, visibleVps().join()].join(':');
  if (sig !== reportCache.sig) reportCache = { sig, R: buildReport() };
  return reportCache.R;
}

const quote = (t) => T(`„${t}“`, `“${t}”`);
const itemText = (i) => [i.path || i.desc, i.text ? quote(i.text) : '', i.note ? `(${i.note})` : ''].filter(Boolean).join(' ');
const isDefaultChecklist = (cl) => Object.values(CHECKLISTS).some((d) => cl.length === d.length && cl.every((c, i) => !c.done && c.text === d[i]));

function buildReport() {
  const vis = visibleVps();
  const ready = isReady();
  const viewports = {};
  for (const vp of vis) {
    const r = rt[vp];
    const p = settings.panes[vp];
    const a = r.audit;
    const issues = {};
    if (a) for (const is of ISSUES) {
      const list = a.issues[is.key];
      if (list.length) issues[is.key] = { label: is.label, severity: is.sev, count: list.length, items: list.slice(0, 15).map((i) => ({ path: i.path || null, text: i.text || null, note: i.note || null, element: i.desc, ref: i.ref || null })) };
    }
    const round = (m, v) => (v === null || v === undefined ? null : m.key === 'cls' ? Math.round(v * 1000) / 1000 : Math.round(v));
    viewports[vp] = {
      name: VP_NAME[vp], width: p.w, height: p.h, url: r.url, title: r.title,
      status: r.error ? 'error' : r.slow ? 'timeout' : r.loading ? 'loading' : !r.probe ? 'not-measured' : 'ok',
      error: r.error || null,
      httpStatus: r.httpStatus || null,
      loadMs: r.loadMs === null ? null : Math.round(r.loadMs),
      horizontalOverflowPx: a ? Math.max(0, a.scrollWidth - a.viewportWidth) : null,
      perf: r.perf ? Object.fromEntries(METRICS.map((m) => [m.key, round(m, r.perf[m.key])])) : null,
      ratings: r.perf ? Object.fromEntries(METRICS.filter((m) => m.good !== undefined).map((m) => [m.key, rate(m, r.perf[m.key]) || null])) : null,
      lcpElement: r.perf ? r.perf.lcpEl || null : null,
      queuedMs: r.perf && typeof r.perf.queued === 'number' ? r.perf.queued : null, // already subtracted from the timings
      resQueuedMs: r.perf && typeof r.perf.resQueued === 'number' ? r.perf.resQueued : null, // longest visible wait of a subresource
      redirectMs: r.perf && typeof r.perf.redirectMs === 'number' ? r.perf.redirectMs : null,
      lcpUrl: r.perf ? r.perf.lcpUrl || null : null,
      slowestResources: r.perf ? r.perf.slowest.slice(0, 5) : null,
      largestResources: r.perf ? r.perf.largest.filter((x) => x.size).slice(0, 5) : null,
      pageCheckError: r.auditError || null,
      issues,
    };
  }
  const src = ['desktop', 'tablet', 'mobile'].find((vp) => vis.includes(vp) && rt[vp].audit);
  const page = src ? rt[src].audit.page : null;
  const pageChecksList = page ? pageChecks(page).map((c) => ({ id: c.id, check: c.k, value: c.v, status: c.status || 'info', hint: c.hint || null })) : [];
  const levelRank = { error: 0, warn: 1, info: 2 };
  const consoleEntries = [...logs.values()]
    .filter((e) => e.level === 'error' || e.level === 'warn' || (e.level === 'info' && (e.source === 'dialog' || e.source === 'bench')))
    .sort((x, y) => (x.level === y.level ? y.count - x.count : levelRank[x.level] - levelRank[y.level])).slice(0, 60)
    .map((e) => ({ level: e.level, source: e.source, message: e.message.slice(0, 500), where: e.where || e.resourceUrl || null, stack: e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : null, viewports: [...e.vps], count: e.count, pageUrl: e.pageUrl }));
  const failed = netGroups(isNetProblem).slice(0, 60).map((g) => ({ status: netStatus(g.last), method: g.last.method, type: NET_TYPES[g.last.type] || g.last.type, url: g.last.url, viewports: [...g.vps], count: g.count }));
  const linksChecked = [...linkResults.values()].filter((r) => r.status !== 'pending').length;
  const brokenLinks = [...linkResults.entries()].filter(([, r]) => linkProblem(r)).map(([url, r]) => ({ url, status: r.status, note: r.note || null }));

  // Verdict lines first, so a reader (or an AI) sees what matters at once. "bad" = must look at.
  const findings = [];
  const add = (severity, text) => findings.push({ severity, text });
  if (!ready) {
    const pending = vis.filter((vp) => rt[vp].loading || (rt[vp].probe && !(rt[vp].perf && (rt[vp].audit || rt[vp].auditError))));
    add('bad', T('Měření nedoběhlo', 'The measurement did not finish') + (pending.length ? ': ' + pending.map((vp) => VP_NAME[vp]).join(', ') + T(' se stále načítá nebo měří', ' still loading or measuring') : '') + T('. Údaje mohou chybět.', '. Data may be missing.'));
  }
  for (const vp of vis) {
    const v = viewports[vp];
    if (v.status === 'error') add('bad', `${v.name}: ${T('stránka se nenačetla', 'the page did not load')} (${v.error})`);
    else if (v.status === 'timeout') add('bad', `${v.name}: ${T('stránka se nenačetla do 30 s', 'the page did not load within 30 s')}`);
    else if (v.status === 'not-measured') add('bad', `${v.name}: ${T('stránku se nepodařilo změřit (měřicí skript se do ní nedostal – PDF, chybová stránka prohlížeče, nebo web zobrazení v rámu odmítl)', 'the page could not be measured (the measuring script did not get in – a PDF, a browser error page, or the site refused to be framed)')}`);
    if (v.httpStatus) add('bad', `${v.name}: ${T('dokument vrátil', 'the document returned')} HTTP ${v.httpStatus}`);
  }
  const errs = consoleEntries.filter((e) => e.level === 'error');
  const warns = consoleEntries.filter((e) => e.level === 'warn' && e.source !== 'bench');
  for (const e of consoleEntries) if (e.level === 'warn' && e.source === 'bench') add('warn', e.message);
  const eg = T('např.', 'e.g.');
  if (errs.length) add('bad', `${T('Konzole', 'Console')}: ${errs.length} ${plural(errs.length, 'chyba', 'chyby', 'chyb', 'error')}, ${eg} ${mdCode(errs[0].message.split('\n')[0].slice(0, 120))}`);
  if (warns.length) add('warn', `${T('Konzole', 'Console')}: ${warns.length} ${plural(warns.length, 'varování', 'varování', 'varování', 'warning')}, ${eg} ${mdCode(warns[0].message.split('\n')[0].slice(0, 120))}`);
  if (failed.length) add('bad', `${T('Síť', 'Network')}: ${failed.length} ${plural(failed.length, 'neúspěšný požadavek', 'neúspěšné požadavky', 'neúspěšných požadavků', 'failed request')}, ${eg} ${failed[0].status} ${mdCode(failed[0].url)}`);
  const measured = vis.filter((x) => viewports[x].perf);
  // The three frames share the browser's request queue (identical requests go one after another),
  // and only the document's wait can be measured. A frame whose timing is worse than another
  // frame measuring the same thing is therefore judged by that frame: TTFB is the same document
  // everywhere, FCP the same render path, LCP only when it is the same element (a mobile-only
  // hero image is a real mobile problem). `ratings` holds the judged values, `rawRatings` the raw.
  const rank = { good: 0, warn: 1, bad: 2 };
  for (const vp of measured) {
    const v = viewports[vp];
    v.rawRatings = { ...v.ratings };
    v.queueLimited = [];
    for (const k of ['ttfb', 'fcp', 'lcp']) {
      const x = v.ratings[k];
      if (x !== 'bad' && x !== 'warn') continue;
      const m = METRICS.find((mm) => mm.key === k);
      const same = (o) => k !== 'lcp' || (v.lcpElement && viewports[o].lcpElement === v.lcpElement && rt[o].perf.lcpUrl === rt[vp].perf.lcpUrl);
      const peers = measured.filter((o) => o !== vp && viewports[o].perf[k] !== null && same(o));
      if (!peers.length) continue;
      const best = Math.min(...peers.map((o) => viewports[o].perf[k]));
      const bestRating = rate(m, best);
      // Only when the measured waiting explains the difference: a different file or a resource
      // that is slow for this viewport only is a real finding, not the queue.
      const minRedirect = Math.min(...measured.map((o) => rt[o].perf.redirectMs || 0));
      const explained = (rt[vp].perf.resQueued || 0) + Math.max(0, (rt[vp].perf.redirectMs || 0) - minRedirect) + 150;
      if (rank[bestRating] < rank[x] && v.perf[k] - best <= explained) { v.ratings[k] = bestRating; v.queueLimited.push(k); }
    }
  }
  for (const vp of vis) if (!viewports[vp].queueLimited) viewports[vp].queueLimited = [];
  for (const vp of vis) {
    const v = viewports[vp];
    if (v.horizontalOverflowPx) add('bad', `${v.name} ${v.width} px: ${T('vodorovný posun', 'horizontal scroll')} +${v.horizontalOverflowPx} px${v.issues.overflow ? T(', způsobuje ', ', caused by ') + v.issues.overflow.items.slice(0, 2).map((i) => mdCode(itemText(i))).join(', ') : ''}`);
    for (const key of ['broken', 'mixed']) if (v.issues[key]) add('bad', `${v.name}: ${v.issues[key].label.toLowerCase()} ${v.issues[key].count}×`);
    if (v.ratings) {
      const pick = (keys) => keys.map((k) => METRICS.find((m) => m.key === k));
      const bad = pick(Object.keys(v.ratings).filter((k) => v.ratings[k] === 'bad'));
      const warn = pick(Object.keys(v.ratings).filter((k) => v.ratings[k] === 'warn' && !v.queueLimited.includes(k)));
      if (bad.length) add('bad', `${v.name}: ${T('špatné', 'poor')} ${bad.map((m) => `${m.label} ${m.f(v.perf[m.key])}`).join(', ')}`);
      if (v.queueLimited.length) add('warn', `${v.name}: ${T('pomalé', 'slow')} ${pick(v.queueLimited).map((m) => `${m.label} ${m.f(v.perf[m.key])}`).join(', ')}${T(', stejná věc byla v jiném rámu rychlejší – rozdíl je nejspíš čekání ve frontě panelu', ', the same thing was faster in another frame – the difference is most likely the bench\'s request queue')}`);
      if (warn.length) add('warn', `${v.name}: ${T('zlepšit', 'needs improvement')} ${warn.map((m) => `${m.label} ${m.f(v.perf[m.key])}`).join(', ')}`);
    }
    const minor = ISSUES.filter((is) => is.sev === 'warn' && v.issues[is.key]).map((is) => `${is.label.toLowerCase()} ${v.issues[is.key].count}×`);
    if (minor.length) add('warn', `${v.name}: ${minor.join(', ')}`);
    if (v.pageCheckError) add('bad', `${v.name}: ${T('kontrolu stránky se nepodařilo provést', 'the page check could not run')} (${v.pageCheckError})${T(', přetečení a další problémy nejsou známé', ', overflow and other problems are unknown')}`);
  }
  const pageWord = T('Stránka', 'Page');
  for (const c of pageChecksList) if (c.status === 'bad') add('bad', `${pageWord}: ${c.check} – ${tagsToCode(c.hint || c.value)}`);
  const pageWarn = pageChecksList.filter((c) => c.status === 'warn');
  if (pageWarn.length) add('warn', `${pageWord}: ${T('zkontroluj', 'check')} ${pageWarn.map((c) => LANG === 'cs' ? c.check[0].toLowerCase() + c.check.slice(1) : c.check).join(', ')} ${T('(podrobnosti v části Stránka)', '(details in the Page section)')}`);
  if (brokenLinks.length) add('bad', `${T('Odkazy', 'Links')}: ${brokenLinks.length} ${plural(brokenLinks.length, 'nefunkční', 'nefunkční', 'nefunkčních', 'broken', 'broken')}`);

  const manualUsed = notesState.host && (notesState.notes.length || !isDefaultChecklist(notesState.checklist));
  return {
    tool: 'Web Test Bench', version: chrome.runtime.getManifest().version, language: LANG, generatedAt: new Date().toISOString(),
    url: masterUrl, ready,
    passed: ready && !findings.some((f) => f.severity === 'bad'),
    notes: T('Rámy simulují velikost obrazovky (CSS breakpointy), ne User-Agent serveru ani dotyk. Časy jsou orientační, rámy se načítají současně; prohlížeč posílá stejné požadavky ze tří rámů postupně. Čekání dokumentu ve frontě je odečtené (queuedMs), čekání u přesměrování a zdrojů ne, proto se rám hodnotí podle rychlejšího rámu, který měřil totéž (LCP: stejný prvek i soubor), jen když rozdíl vysvětluje naměřené čekání (resQueuedMs u zdrojů, delší přesměrování). Čekání u zdrojů z cizích domén bez Timing-Allow-Origin vidět není. ratings = hodnocení, rawRatings = podle prahů, queueLimited = metriky hodnocené podle jiného rámu. LCP null = prohlížeč ho pro rám nenahlásil.', 'The frames emulate the screen size (CSS breakpoints), not the User-Agent sent to the server or touch. Timings are indicative: the frames load at the same time and the browser sends identical requests from the three frames one after another. The document\'s queueing is subtracted (queuedMs); queueing of redirects and resources is not, so a frame is judged by a faster frame that measured the same thing (LCP: the same element and file), but only when the measured waiting explains the difference (resQueuedMs for resources, a longer redirect). Waiting of resources from other origins without Timing-Allow-Origin is not visible. ratings = judged, rawRatings = by thresholds only, queueLimited = metrics judged by another frame. LCP null = the browser did not report it for the frame.'),
    findings,
    viewports,
    page: page ? { checks: pageChecksList, headings: rt[src].audit.headings.map((hd) => ({ level: hd.level, text: hd.text, hidden: hd.hidden })) } : null,
    console: consoleEntries,
    failedRequests: failed,
    links: { found: collectLinks().length, checked: linksChecked, broken: brokenLinks },
    manualTesting: manualUsed ? { checklist: notesState.checklist, notes: notesState.notes.map((n) => ({ kind: n.kind, text: n.text, viewports: n.vps || 'all', url: n.url })) } : null,
  };
}

// HTML tags in hints (e.g. <link rel="canonical">) would vanish when the Markdown is rendered.
const tagsToCode = (t) => String(t).replace(/<[^>`]+>/g, (m) => '`' + m + '`');
const mdCode = (t) => { const v = String(t).replace(/\s+/g, ' ').trim(); return v.includes('`') ? '`` ' + v + ' ``' : '`' + v + '`'; };

function reportMarkdown() {
  const R = buildReport();
  const L = [];
  const vis = Object.keys(R.viewports);
  const name = (vp) => R.viewports[vp].name;
  L.push(`# ${T('Test webu', 'Web test')} ${splitUrl(R.url).host}`, '', `- ${T('Adresa', 'URL')}: ${R.url}`, `- ${T('Čas', 'Time')}: ${new Date(R.generatedAt).toLocaleString(LOCALE)}`,
    `- ${T('Velikosti', 'Sizes')}: ${vis.map((vp) => `${name(vp)} ${R.viewports[vp].width}×${R.viewports[vp].height}`).join(', ')}`,
    `- ${T('Výsledek', 'Result')}: ${!R.ready ? T('měření nedoběhlo, údaje mohou chybět', 'the measurement did not finish, data may be missing') : R.passed ? T('bez závažných problémů', 'no serious problems') : T('našly se závažné problémy (✗)', 'serious problems found (✗)')}`, '');
  L.push(T('## Hlavní zjištění', '## Key findings'), '');
  if (R.findings.length) for (const f of R.findings) L.push(`- ${f.severity === 'bad' ? '✗' : '⚠'} ${f.text}`);
  else L.push(T('- ✓ Žádné problémy.', '- ✓ No problems.'));
  L.push('');

  const measured = vis.filter((vp) => R.viewports[vp].perf);
  if (measured.length) {
    L.push(T('## Výkon', '## Performance'), '', `| ${T('Metrika', 'Metric')} | ${measured.map(name).join(' | ')} |`, `|---|${measured.map(() => '---:').join('|')}|`);
    for (const m of METRICS) {
      L.push(`| ${m.label} | ${measured.map((vp) => {
        const v = R.viewports[vp];
        const val = v.perf[m.key];
        const rating = v.ratings && v.ratings[m.key];
        const queue = v.queueLimited.includes(m.key) ? T(' (fronta)', ' (queue)') : '';
        return val === null || val === undefined ? '–' : m.f(val) + (rating === 'bad' ? ' ✗' : rating === 'warn' ? ' ⚠' : '') + queue;
      }).join(' | ')} |`);
    }
    L.push('', T('✗ špatné, ⚠ zlepšit (hranice Core Web Vitals). (fronta) = stejná věc byla v jiném rámu rychlejší, hodnocení podle něj. – = nezměřeno (LCP prohlížeč u malých stránek někdy nenahlásí).', '✗ poor, ⚠ needs improvement (Core Web Vitals thresholds). (queue) = the same thing was faster in another frame and is rated by it. – = not measured (browsers sometimes report no LCP for small pages).'), '');
    const slow = R.viewports[measured[measured.length - 1]].slowestResources || [];
    if (slow.length) {
      L.push(`${T('Nejpomalejší zdroje', 'Slowest resources')} (${name(measured[measured.length - 1])}):`, '');
      for (const x of slow) L.push(`- ${fmtMs(x.duration)} ${x.type} ${mdCode(x.url)}`);
      L.push('');
    }
  }

  const rows = ISSUES.filter((is) => vis.some((vp) => R.viewports[vp].issues[is.key]));
  if (rows.length) {
    L.push(T('## Problémy podle velikosti', '## Problems by size'), '', `| ${T('Problém', 'Problem')} | ${vis.map(name).join(' | ')} |`, `|---|${vis.map(() => '---:').join('|')}|`);
    for (const is of rows) L.push(`| ${is.label} | ${vis.map((vp) => (R.viewports[vp].issues[is.key] ? R.viewports[vp].issues[is.key].count : 0)).join(' | ')} |`);
    L.push('');
    for (const vp of vis) {
      const v = R.viewports[vp];
      const keys = Object.keys(v.issues).filter((k) => v.issues[k].severity !== 'info');
      if (!keys.length) continue;
      L.push(`### ${v.name} (${v.width} px)`, '');
      for (const k of keys) {
        L.push(`- ${v.issues[k].label} (${v.issues[k].count}):`);
        for (const i of v.issues[k].items.slice(0, 6)) L.push(`  - ${mdCode(itemText(i))}`);
        if (v.issues[k].count > 6) L.push(T(`  - … a dalších ${v.issues[k].count - 6}`, `  - … and ${v.issues[k].count - 6} more`));
      }
      L.push('');
    }
  }

  if (R.page) {
    L.push(T('## Stránka', '## Page'), '');
    for (const c of R.page.checks) L.push(`- ${c.status === 'good' ? '✓' : c.status === 'bad' ? '✗' : c.status === 'warn' ? '⚠' : '·'} ${c.check}: ${mdCode(c.value)}${c.hint ? ' – ' + tagsToCode(c.hint) : ''}`);
    L.push('');
  }
  if (R.console.length) {
    const lvl = { error: T('Chyba', 'Error'), warn: T('Varování', 'Warning'), info: 'Info' };
    L.push(`## ${T('Konzole', 'Console')} (${R.console.length})`, '');
    for (const e of R.console) L.push(`- ${lvl[e.level]} ${mdCode(e.message.split('\n')[0].slice(0, 300))} — ${e.viewports.map((v) => VP_NAME[v]).join(', ')}${e.count > 1 ? `, ${e.count}×` : ''}${e.where ? ', ' + mdCode(e.where) : ''}`);
    L.push('');
  }
  if (R.failedRequests.length) {
    L.push(`## ${T('Neúspěšné požadavky', 'Failed requests')} (${R.failedRequests.length})`, '');
    for (const f of R.failedRequests) L.push(`- ${f.status} ${f.type} ${mdCode(f.url)} — ${f.viewports.map((v) => VP_NAME[v]).join(', ')}`);
    L.push('');
  }
  if (R.links.checked) {
    L.push(T(`## Odkazy (zkontrolováno ${R.links.checked} z ${R.links.found})`, `## Links (${R.links.checked} of ${R.links.found} checked)`), '');
    if (R.links.broken.length) for (const b of R.links.broken) L.push(`- ${b.status === 'error' ? b.note : b.status} ${mdCode(b.url)}`);
    else L.push(T('- Všechny zkontrolované odkazy fungují.', '- All checked links work.'));
    L.push('');
  }
  if (R.manualTesting) {
    const cl = R.manualTesting.checklist;
    L.push(`## ${T('Kontrolní seznam', 'Checklist')} (${cl.filter((c) => c.done).length}/${cl.length})`, '');
    for (const c of cl) L.push(`- [${c.done ? 'x' : ' '}] ${c.text}`);
    L.push('');
    const kindName = NOTE_KIND;
    if (R.manualTesting.notes.length) {
      L.push(T('## Poznámky z ručního testu', '## Notes from manual testing'), '');
      for (const n of R.manualTesting.notes.slice().reverse()) {
        const where = n.viewports === 'all' ? T('všechny velikosti', 'all sizes') : n.viewports.split(',').map((v) => VP_NAME[v] || v).join(', ');
        L.push(`- **${kindName[n.kind]}** (${where}, ${splitUrl(n.url).rest || n.url}): ${n.text.replace(/\n/g, ' ')}`);
      }
      L.push('');
    }
  }
  return L.join('\n');
}

TABS.report = {
  label: T('Zpráva', 'Report'),
  sig: () => [ver.rt, ver.logs, ver.net, ver.links, ver.notes].join(':'),
  mount(panel) {
    this.state = h('span', { class: 'note', role: 'status' });
    this.pre = h('pre', { class: 'report', tabindex: 0, 'aria-label': T('Zpráva v Markdownu', 'Markdown report') });
    panel.append(
      h('div', { class: 'toolbar' },
        h('button', { type: 'button', class: 'btn small primary', html: svg('copy') + T('Kopírovat Markdown', 'Copy Markdown'), onclick: () => copyText(reportMarkdown(), T('Zpráva v Markdownu je ve schránce', 'Markdown report copied')) }),
        h('button', { type: 'button', class: 'btn small', onclick: () => copyText(JSON.stringify(buildReport(), null, 2), T('Zpráva v JSON je ve schránce', 'JSON report copied')) }, T('Kopírovat JSON', 'Copy JSON')),
        h('button', { type: 'button', class: 'btn small', onclick: () => download(`test-${splitUrl(masterUrl).host || 'web'}-${new Date().toISOString().slice(0, 10)}.md`, new Blob([reportMarkdown()], { type: 'text/markdown' })) }, T('Stáhnout .md', 'Download .md')),
        this.state,
        h('span', { class: 'grow' }),
        h('span', { class: 'note' }, T('Pro AI: ', 'For AI: '), h('code', null, 'webTestBench.report()'), T(' v této záložce, nebo ', ' in this tab, or '), h('code', null, 'node tools/wtb.mjs <url>'), T(' v terminálu.', ' in a terminal.'))),
      h('div', { class: 'scroll' }, this.pre));
  },
  update() {
    if (!this.pre || !this.pre.isConnected) return;
    this.state.textContent = !masterUrl ? '' : isReady() ? T('Měření dokončeno', 'Measurement finished') : T('Měření probíhá…', 'Measuring…');
    this.pre.textContent = masterUrl ? reportMarkdown() : T('Načti stránku a zpráva se tady sestaví sama.', 'Load a page and the report builds itself here.');
  },
};

// ---------------------------------------------------------------- automation API

// Stable entry point for AI agents and scripts (tools/wtb.mjs). Exposed before init(); its
// methods wait for init where they need it.
let initDone; // promise of init(), set below
function exposeApi() {
  window.webTestBench = Object.freeze({
    version: 1,
    // Synchronous once the panel is up (so isReady()/report() right after it already reflect
    // the new load); before that it returns a promise.
    load(url) {
      const go = () => { loadUrl(url); return masterUrl; };
      return myTab ? go() : initDone.then(go);
    },
    isReady: () => !!myTab && isReady(),
    async waitUntilReady(timeoutMs = 45000) {
      await initDone;
      const t0 = Date.now();
      await new Promise((res) => setTimeout(res, 300));
      while (!isReady() && Date.now() - t0 < timeoutMs) await new Promise((res) => setTimeout(res, 250));
      if (!isReady()) {
        // Out of time: measure whatever has loaded so the report is as complete as it can be.
        for (const vp of visibleVps()) measureNow(vp);
        await new Promise((res) => setTimeout(res, 1500));
      }
      return isReady();
    },
    report: () => buildReport(),
    reportMarkdown: () => reportMarkdown(),
    async checkLinks(scope = 'all') {
      const links = collectLinks().filter((l) => scope === 'all' || (scope === 'internal') === l.internal);
      await runLinkCheck(links);
      return buildReport().links;
    },
    setSize(vp, w, hgt) {
      if (!VPS.includes(vp)) throw new Error('viewport must be mobile, tablet or desktop');
      Object.assign(settings.panes[vp], { w: Math.max(200, Math.min(3840, +w)), h: Math.max(200, Math.min(4000, +hgt)), preset: 'custom' });
      saveSettings();
      renderStage();
    },
    setVisible(vp, visible) { if (!!settings.panes[vp].hidden === !!visible) togglePane(vp); },
    setZoom(z) { settings.zoom = String(z); $('#zoom').value = settings.zoom; renderStage(); },
    // Flash an element from the report in a frame: ref is issues.<key>.items[n].ref
    highlight(vp, ref) { postCmd(vp, 'highlight', { ref: +ref }); },
    // Diagnostics: the per-frame state the dashboard works with.
    state: () => Object.fromEntries(VPS.map((vp) => [vp, (({ url, loading, probe, error, httpStatus, cmdAt, lastInput, docRequestAt, awaitingHello }) => ({ url, loading, probe, error, httpStatus, cmdAt, lastInput, docRequestAt, awaitingHello }))(rt[vp])])),
  });
}

// ---------------------------------------------------------------- toolbar wiring

function renderHistory() {
  $('#history').replaceChildren(...settings.history.map((u) => h('option', { value: u })));
}

// Reordering uses pointer events, not HTML5 drag and drop: native DnD on Linux/Wayland can
// stay stuck after the first drop when the dragged element is re-rendered.
function renderPaneChips() {
  const wrap = $('#paneChips');
  const order = ordered();
  wrap.replaceChildren(...order.map((vp, i) => {
    const chip = chipToggle(VP_NAME[vp], !settings.panes[vp].hidden, () => {
      if (chip.dataset.dragged) { delete chip.dataset.dragged; return; } // the click that ends a drag
      togglePane(vp);
    }, {
      class: 'vp-' + vp, dot: true,
      title: T(`Klik: zobrazit nebo skrýt (${i + 1}). Přetažením nebo Alt+šipkou změníš pořadí.`, `Click: show or hide (${i + 1}). Drag or use Alt+arrow to reorder.`),
    });
    chip.dataset.vp = vp;
    chip.classList.add('movable');
    chip.addEventListener('pointerdown', (e) => startChipDrag(e, chip, vp));
    chip.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      const from = order.indexOf(vp);
      const to = from + (e.key === 'ArrowRight' ? 1 : -1);
      if (to < 0 || to >= order.length) return;
      const next = order.slice();
      [next[from], next[to]] = [next[to], next[from]];
      setOrder(next, vp);
    });
    return chip;
  }));
}

function startChipDrag(e, chip, vp) {
  if (e.button !== 0) return;
  const wrap = $('#paneChips');
  const startX = e.clientX;
  let dragging = false;
  let target = null;
  const chips = () => [...wrap.querySelectorAll('.chip')].filter((c) => c !== chip);
  const move = (ev) => {
    const dx = ev.clientX - startX;
    if (!dragging && Math.abs(dx) < 6) return;
    if (!dragging) { dragging = true; chip.classList.add('dragging'); chip.setPointerCapture(ev.pointerId); }
    chip.style.transform = `translateX(${dx}px)`;
    // Insert before the first other chip whose centre is right of the pointer.
    const others = chips();
    target = others.find((c) => { const r = c.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2; }) || null;
    others.forEach((c) => c.classList.remove('drop-before', 'drop-after'));
    if (target) target.classList.add('drop-before');
    else if (others.length) others[others.length - 1].classList.add('drop-after');
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    if (!dragging) return;
    chip.dataset.dragged = '1';
    setTimeout(() => { delete chip.dataset.dragged; }, 0);
    const next = ordered().filter((v) => v !== vp);
    const idx = target ? next.indexOf(target.dataset.vp) : next.length;
    next.splice(idx, 0, vp);
    if (next.join() === ordered().join()) { renderPaneChips(); return; }
    setOrder(next, vp);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function setOrder(next, focusVp) {
  settings.order = next;
  saveSettings();
  renderPaneChips();
  renderStage();
  ver.rt++; ver.logs++; ver.net++; ver.links++;
  scheduleRender();
  const c = $(`#paneChips [data-vp="${focusVp}"]`);
  if (c) c.focus();
  toast(T('Pořadí: ', 'Order: ') + next.map((v) => VP_NAME[v]).join(', '));
}

function togglePane(vp) {
  const p = settings.panes[vp];
  if (!p.hidden && visibleVps().length === 1) { toast(T('Aspoň jedna velikost musí zůstat zobrazená', 'At least one size must stay visible')); return; }
  p.hidden = !p.hidden;
  saveSettings();
  renderPaneChips();
  if (p.hidden) {
    // Unload a hidden frame so it stops running, logging and loading.
    const r = rt[vp];
    clearTimeout(r.watchdog);
    Object.assign(r, { url: '', loading: false, probe: false, perf: null, audit: null, error: '', blankThen: null });
    frameGo(els[vp].iframe, 'about:blank');
    forgetLogs(vp);
  }
  renderStage();
  if (!p.hidden && masterUrl) afterLayout(() => navigateFrame(vp, masterUrl, { force: true }));
  ver.rt++;
  scheduleRender();
}

function wireToolbar() {
  els.url = $('#url');
  els.stage = $('#stage');
  $('#backBtn').innerHTML = svg('back');
  $('#fwdBtn').innerHTML = svg('forward');
  $('#reloadBtn').innerHTML = svg('reload');
  $('#shotAll').innerHTML = svg('camera');
  $('#settingsBtn').innerHTML = svg('sliders');

  $('#urlForm').addEventListener('submit', (e) => { e.preventDefault(); loadUrl(els.url.value); els.url.blur(); });
  $('#reloadBtn').addEventListener('click', reloadAll);
  els.back = $('#backBtn');
  els.fwd = $('#fwdBtn');
  els.back.disabled = els.fwd.disabled = true;
  els.back.addEventListener('click', () => goHistory(-1));
  els.fwd.addEventListener('click', () => goHistory(1));
  $('#shotAll').addEventListener('click', () => screenshot(els.stage, 'bench'));
  $('#dockHide').innerHTML = svg('close');
  $('#dockMin').addEventListener('click', () => setDockMode(settings.dockMode === 'min' ? 'open' : 'min'));
  $('#dockHide').addEventListener('click', () => setDockMode('hidden'));
  $('#dockFab').addEventListener('click', () => { setDockMode('open'); TABS[settings.activeTab].btn.focus(); });

  const bindSwitch = (id, key, after) => {
    const el = $('#' + id);
    el.checked = !!settings[key];
    el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); after && after(); });
  };
  bindSwitch('syncScroll', 'syncScroll');
  bindSwitch('syncNav', 'syncNav', () => { if (masterUrl) updateAddress(); });
  bindSwitch('keepLog', 'keepLog');
  bindSwitch('mobileUA', 'mobileUA', () => {
    for (const vp of ['mobile', 'tablet']) {
      recreateFrame(vp);
      if (masterUrl && !settings.panes[vp].hidden) afterLayout(() => navigateFrame(vp, masterUrl, { force: true }));
    }
    toast(settings.mobileUA ? T('Mobil a tablet teď hlásí JavaScriptu mobilní User-Agent', 'Mobile and tablet now report a mobile User-Agent to JavaScript') : T('Mobil a tablet teď hlásí výchozí User-Agent', 'Mobile and tablet now report the default User-Agent'));
  });

  // Language: remembered in localStorage (read before the first render) and applied by reloading.
  const langSel = $('#lang');
  let langStored = null;
  try { langStored = localStorage.getItem('wtb-lang'); } catch (e) { /* storage blocked */ }
  langSel.value = langStored === 'cs' || langStored === 'en' ? langStored : 'auto';
  langSel.addEventListener('change', () => {
    try { if (langSel.value === 'auto') localStorage.removeItem('wtb-lang'); else localStorage.setItem('wtb-lang', langSel.value); } catch (e) { /* storage blocked */ }
    location.replace(location.pathname + (masterUrl ? '?url=' + encodeURIComponent(masterUrl) : ''));
  });

  for (const b of document.querySelectorAll('[data-overlay]')) {
    b.setAttribute('aria-pressed', String(!!settings.overlays[b.dataset.overlay]));
    b.addEventListener('click', () => setOverlay(b.dataset.overlay, !settings.overlays[b.dataset.overlay]));
  }

  const zoom = $('#zoom');
  zoom.value = settings.zoom;
  zoom.addEventListener('change', () => { settings.zoom = zoom.value; saveSettings(); renderStage(); });

  const pop = $('#settings');
  const sbtn = $('#settingsBtn');
  const setPop = (open) => { pop.hidden = !open; sbtn.setAttribute('aria-expanded', String(open)); };
  sbtn.addEventListener('click', (e) => { e.stopPropagation(); setPop(pop.hidden); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) setPop(false); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { setPop(false); return; }
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    if (e.key === '/') { e.preventDefault(); els.url.focus(); els.url.select(); }
    else if (e.key === 'r' || e.key === 'R') reloadAll();
    else if (['1', '2', '3'].includes(e.key)) togglePane(ordered()[+e.key - 1]);
    else if (e.key === 'd' || e.key === 'D') setDockMode(settings.dockMode === 'open' ? 'min' : 'open');
  });

  // Dock resizer
  const rz = $('#resizer');
  const setDock = (px) => {
    const hpx = Math.max(120, Math.min(window.innerHeight - 220, px));
    settings.dockHeight = hpx;
    document.body.style.setProperty('--dock-h', hpx + 'px');
  };
  setDock(settings.dockHeight);
  rz.addEventListener('pointerdown', (e) => {
    rz.setPointerCapture(e.pointerId);
    rz.classList.add('dragging');
    els.stage.style.pointerEvents = 'none';
    const move = (ev) => setDock(window.innerHeight - ev.clientY - 3);
    const up = () => {
      rz.classList.remove('dragging');
      els.stage.style.pointerEvents = '';
      rz.removeEventListener('pointermove', move);
      rz.removeEventListener('pointerup', up);
      saveSettings();
      renderStage();
    };
    rz.addEventListener('pointermove', move);
    rz.addEventListener('pointerup', up);
  });
  rz.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { setDock(settings.dockHeight + 24); saveSettings(); }
    if (e.key === 'ArrowDown') { setDock(settings.dockHeight - 24); saveSettings(); }
  });

  new ResizeObserver(() => { if (settings.zoom === 'fit') renderStage(); }).observe(els.stage);
}

// ---------------------------------------------------------------- init

async function init() {
  const stored = (await chrome.storage.local.get('settings')).settings;
  if (stored) {
    settings = { ...structuredClone(DEFAULTS), ...stored, panes: { ...structuredClone(DEFAULTS.panes), ...stored.panes }, overlays: { ...DEFAULTS.overlays, ...stored.overlays } };
    if (!TABS[settings.activeTab]) settings.activeTab = 'console';
    if (!Array.isArray(settings.order) || settings.order.length !== 3 || !VPS.every((v) => settings.order.includes(v))) settings.order = VPS.slice();
  }
  myTab = await chrome.tabs.getCurrent();
  await installFrameRule();
  setupWebRequest();

  wireToolbar();
  for (const vp of VPS) buildPane(vp);
  renderPaneChips();
  renderHistory();
  buildTabs();
  selectTab(settings.activeTab);
  setDockMode(['open', 'min', 'hidden'].includes(settings.dockMode) ? settings.dockMode : 'open');

  const q = new URLSearchParams(location.search).get('url');
  if (q) loadUrl(q);
  else { renderStage(); els.url.focus(); }
}

exposeApi();
initDone = init();
initDone.catch((e) => {
  console.error(e);
  document.body.prepend(h('div', { class: 'flag', style: { margin: '8px' } }, T('Panel se nepodařilo spustit: ', 'The bench failed to start: ') + e.message));
});
