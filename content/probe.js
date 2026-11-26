// Main world. Does nothing unless this document sits directly inside the
// Web Test Bench dashboard (an extension page) in a frame named "wt-<viewport>".
// There it reports console output, errors, performance and page checks to the
// dashboard and executes its commands (sync scroll, overlays, highlight, ...).
(() => {
  const ao = location.ancestorOrigins;
  if (!ao || ao.length !== 1 || !ao[0].startsWith('chrome-extension://')) return;
  const nameMatch = /^wt-(\w+)(-ua)?$/.exec(window.name);
  if (!nameMatch) return;
  if (window.__wtProbe) return;
  window.__wtProbe = true;

  const VP = nameMatch[1];
  const PARENT = ao[0];
  // Budgets: errors and warnings are kept (a hard cap only stops runaway loops);
  // log/info are rate-limited per 10 s window so chatty pages cannot hide errors.
  const budget = { error: { max: 2000, used: 0 }, chatty: { max: 150, used: 0, windowStart: 0, dropped: 0 } };

  const post = (kind, data = {}) => {
    try {
      window.parent.postMessage({ __wt: 1, kind, vp: VP, url: location.href, t: Date.now(), ...data }, PARENT);
    } catch (e) { /* cannot clone, ignore */ }
  };

  // ---------- Optional mobile user agent (JS only) ----------
  if (nameMatch[2]) {
    const ua = VP === 'tablet'
      ? 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    try {
      Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua, configurable: true });
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => (VP === 'tablet' ? 'iPad' : 'iPhone'), configurable: true });
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5, configurable: true });
    } catch (e) { /* ignore */ }
  }

  // ---------- Viewport fidelity ----------
  // Phones and tablets use overlay scrollbars; a classic 15 px scrollbar would make the
  // frame narrower than its label and report false horizontal overflow.
  // Scrolling past the end of the page must not scroll the bench around the frame
  // (scroll chaining), as it would on a real device.
  {
    const st = document.createElement('style');
    st.textContent = 'html{overscroll-behavior:contain!important}' +
      (VP !== 'desktop' ? 'html{scrollbar-width:none!important}html::-webkit-scrollbar{display:none!important}' : '');
    (document.head || document.documentElement).appendChild(st);
  }
  // A cache-first service worker would serve documents with their original X-Frame-Options
  // on reload. Registrations here are partitioned to the bench, so removing them is safe.
  if (navigator.serviceWorker) {
    try {
      const sw = navigator.serviceWorker;
      sw.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      let told = false;
      sw.register = () => {
        if (!told) { told = true; setTimeout(() => post('log', { level: 'warn', source: 'bench', message: 'Stránka registruje service worker, v náhledu je vypnutý. Pokud na něm stránka závisí, může se tu chovat jinak než v prohlížeči.' }), 0); }
        const err = new DOMException('Service worker je ve Web Test Bench vypnutý.', 'SecurityError');
        err.__wtBench = true; // our own rejection: not reported as a page error
        return Promise.reject(err);
      };
    } catch (e) { /* ignore */ }
  }

  // ---------- Serialisation ----------
  const describeNode = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
    if (cls.length) s += '.' + cls.join('.');
    return s;
  };

  const fmt = (v, depth = 0) => {
    try {
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
      if (typeof v === 'symbol') return v.toString();
      if (typeof v === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
      if (v instanceof Error) return v.name + ': ' + v.message;
      if (typeof Node !== 'undefined' && v instanceof Node) return '<' + describeNode(v) + '>';
      if (depth > 1) return Array.isArray(v) ? '[…]' : '{…}';
      const seen = new WeakSet();
      const json = JSON.stringify(v, (k, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
          if (typeof Node !== 'undefined' && val instanceof Node) return '<' + describeNode(val) + '>';
        }
        if (typeof val === 'function') return 'ƒ';
        if (typeof val === 'bigint') return String(val);
        return val;
      });
      return json && json.length > 600 ? json.slice(0, 600) + '…' : json;
    } catch (e) {
      return Object.prototype.toString.call(v);
    }
  };

  // Substitutes %s %d %i %f %o %O %c in the first string argument like the console does.
  const formatArgs = (args) => {
    if (!args.length) return '';
    let rest = Array.from(args);
    let out = '';
    if (typeof rest[0] === 'string' && /%[sdifoOc]/.test(rest[0])) {
      const first = rest.shift();
      out = first.replace(/%([sdifoOc])/g, (m, f) => {
        if (!rest.length) return m;
        const a = rest.shift();
        if (f === 'c') return '';
        if (f === 'd' || f === 'i') return String(parseInt(a, 10));
        if (f === 'f') return String(parseFloat(a));
        return fmt(a);
      });
      return [out, ...rest.map((a) => fmt(a))].join(' ');
    }
    return rest.map((a) => fmt(a)).join(' ');
  };

  const firstStack = (args) => {
    for (const a of args) if (a instanceof Error && a.stack) return a.stack;
    return '';
  };

  const callerStack = () => {
    const s = new Error().stack || '';
    // drop "Error", this function and the console wrapper
    return s.split('\n').slice(3).join('\n');
  };

  const allowed = (level) => {
    if (level === 'error' || level === 'warn') {
      const b = budget.error;
      if (b.used >= b.max) return false;
      if (++b.used === b.max) post('log', { level: 'warn', source: 'bench', message: 'Web Test Bench: stránka vypsala ' + b.max + ' chyb a varování, další se už nezaznamenávají.' });
      return true;
    }
    const b = budget.chatty;
    const now = Date.now();
    if (now - b.windowStart > 10000) {
      if (b.dropped) post('log', { level: 'info', source: 'bench', message: 'Web Test Bench: vynecháno ' + b.dropped + ' výpisů console.log/info (víc než ' + b.max + ' za 10 s).' });
      b.windowStart = now; b.used = 0; b.dropped = 0;
    }
    if (b.used >= b.max) { b.dropped++; return false; }
    b.used++;
    return true;
  };

  const report = (level, message, extra = {}) => {
    if (!allowed(level)) return;
    post('log', { level, message: String(message).slice(0, 4000), ...extra });
  };

  // ---------- Console ----------
  for (const level of ['error', 'warn', 'info', 'log', 'debug']) {
    const orig = console[level];
    if (typeof orig !== 'function') continue;
    const lvl = level === 'debug' ? 'log' : level;
    console[level] = function (...args) {
      try {
        if (allowed(lvl)) post('log', { level: lvl, message: formatArgs(args).slice(0, 4000),
          source: 'console',
          stack: level === 'error' || level === 'warn' ? (firstStack(args) || callerStack()) : '',
        });
      } catch (e) { /* never break the page */ }
      return orig.apply(this, args);
    };
  }
  const origAssert = console.assert;
  console.assert = function (cond, ...args) {
    if (!cond) report('error', 'Assertion failed: ' + formatArgs(args), { source: 'console', stack: callerStack() });
    return origAssert.call(this, cond, ...args);
  };

  // ---------- Errors ----------
  window.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t !== window && t.nodeType === 1) {
      const url = t.currentSrc || t.src || t.href || '';
      report('error', 'Nepodařilo se načíst <' + t.tagName.toLowerCase() + '> ' + url, { source: 'resource', resourceUrl: url, selector: describeNode(t) });
      return;
    }
    const where = e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : '';
    report('error', e.message || 'Neznámá chyba skriptu', {
      source: 'exception',
      stack: (e.error && e.error.stack) || (where ? '    at ' + where : ''),
      where,
    });
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && r.__wtBench) return;
    report('error', 'Nezachycené odmítnutí Promise: ' + (r instanceof Error ? r.name + ': ' + r.message : fmt(r)), {
      source: 'promise',
      stack: (r && r.stack) || '',
    });
  });

  document.addEventListener('securitypolicyviolation', (e) => {
    report('error', 'CSP zablokovala ' + (e.blockedURI || 'zdroj') + ' (direktiva ' + e.violatedDirective + ')', { source: 'csp' });
  });

  // Dialogs do not block inside the sandboxed frame; log them so they are not missed.
  for (const name of ['alert', 'confirm', 'prompt']) {
    const orig = window[name];
    window[name] = function (msg) {
      report('info', name + '(): ' + fmt(msg), { source: 'dialog' });
      try { return orig.apply(this, arguments); } catch (e) { return name === 'confirm' ? false : null; }
    };
  }

  // fetch / XHR failures that never become console.error (CORS, offline, aborted).
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      return origFetch.apply(this, arguments).then((res) => {
        if (!res.ok && res.type !== 'opaque' && res.type !== 'opaqueredirect') report('warn', 'fetch ' + res.status + ' ' + url, { source: 'fetch', resourceUrl: url });
        return res;
      }, (err) => {
        if (!(err && err.name === 'AbortError')) report('error', 'fetch selhal: ' + url + ' (' + (err && err.message) + ')', { source: 'fetch', resourceUrl: url });
        throw err;
      });
    };
  }
  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__wtUrl = String(url);
    this.addEventListener('error', () => report('error', 'XHR selhal: ' + method + ' ' + this.__wtUrl, { source: 'fetch', resourceUrl: this.__wtUrl }));
    this.addEventListener('load', () => { if (this.status >= 400) report('warn', 'XHR ' + this.status + ' ' + this.__wtUrl, { source: 'fetch', resourceUrl: this.__wtUrl }); });
    return xhrOpen.apply(this, arguments);
  };

  // ---------- User input ----------
  // Navigation sync follows the user: only a frame with real input in the last seconds
  // may move the others (redirects and scripted navigations never do).
  let lastInputPost = 0;
  const onInput = (e) => {
    if (!e.isTrusted) return;
    const now = Date.now();
    if (now - lastInputPost < 250) return;
    lastInputPost = now;
    post('input');
  };
  for (const t of ['pointerdown', 'keydown', 'submit']) window.addEventListener(t, onInput, true);

  // ---------- Navigation ----------
  let auditTimer;
  const scheduleAudit = (ms) => {
    clearTimeout(auditTimer);
    auditTimer = setTimeout(() => {
      postAudit();
      if (overlays.overflow || overlays.a11y) applyOverlays();
    }, ms);
  };
  let lastNavUrl = location.href;
  const reportNav = (kind) => {
    if (location.href === lastNavUrl) return;
    lastNavUrl = location.href;
    post('nav', { title: document.title, navKind: kind });
    if (kind !== 'hash' && document.readyState === 'complete') scheduleAudit(1200);
  };
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      setTimeout(() => reportNav(fn === 'pushState' ? 'push' : 'replace'), 0);
      return r;
    };
  }
  window.addEventListener('popstate', () => reportNav('pop'));
  window.addEventListener('hashchange', () => reportNav('hash'));
  // Page check depends on the viewport size: redo it after the frame is resized.
  window.addEventListener('resize', () => { if (document.readyState === 'complete') scheduleAudit(700); });

  // ---------- Scroll sync ----------
  // Sync by content, not by percentage: pages are much longer on a phone, so "40 % down"
  // shows different content in each frame. The element under a reading line is sent as a
  // locator (path from the nearest element with an id, plus a text signature to verify it).
  const ANCHOR_Y = 0.3; // reading line at 30 % of the frame height
  const docScroller = () => document.scrollingElement || document.documentElement;
  const textHead = (el) => {
    let t = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (t.length < 60 && w.nextNode()) t += w.currentNode.nodeValue.replace(/\s+/g, ' ');
    return t.trim().slice(0, 60);
  };
  const sigOf = (el) => el.tagName + ':' + textHead(el);
  const locator = (el) => {
    const rel = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.id && document.getElementById(n.id) === n) return { base: n.id, rel, sig: sigOf(el) };
      if (!n.parentElement) return null;
      rel.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
    }
    return { base: null, rel, sig: sigOf(el) };
  };
  const resolve = (loc) => {
    if (!loc || !Array.isArray(loc.rel) || loc.rel.length > 200) return null;
    let n = loc.base ? document.getElementById(String(loc.base)) : document.body;
    for (const i of loc.rel) { n = n && n.children[i]; if (!n) break; }
    if (n && sigOf(n) === loc.sig) return n;
    // The DOM differs here (a dismissed cookie bar, a mobile-only block): find the element by its signature.
    const [tag, ...rest] = String(loc.sig || '').split(':');
    if (rest.join(':').length >= 8 && /^[A-Z][A-Z0-9-]*$/.test(tag)) {
      const list = document.getElementsByTagName(tag);
      for (let i = 0; i < list.length && i < 5000; i++) if (sigOf(list[i]) === loc.sig) return list[i];
    }
    return null;
  };
  const isPinned = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const pos = getComputedStyle(n).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  };
  // The innermost element under a point that is tall enough to anchor to.
  const blockAt = (x, y) => {
    for (let el = document.elementFromPoint(x, y); el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.height < 16 || isPinned(el)) continue;
      return { el, r };
    }
    return null;
  };
  // Prefer a block of moderate height near the reading line over a tall wrapper: inside a
  // wrapper the frames drift apart, and switching between wrapper and child makes them jump.
  // The reading line may lie just above or below the chosen block (offset < 0 or > height).
  const findAnchor = () => {
    const y = Math.round(innerHeight * ANCHOR_Y);
    const tall = innerHeight * 0.6;
    let wrapper = null;
    for (const fx of [0.5, 0.3, 0.7, 0.1]) {
      const x = Math.round(innerWidth * fx);
      for (const dy of [0, -12, 12, -28, 28, -60, 60, -120, 120]) {
        const yy = y + dy;
        if (yy < 0 || yy >= innerHeight) continue;
        const hit = blockAt(x, yy);
        if (!hit) continue;
        if (hit.r.height > tall) { if (!wrapper && dy === 0) wrapper = hit; continue; }
        const loc = locator(hit.el);
        if (loc) return { loc, offset: y - hit.r.top, height: hit.r.height };
      }
    }
    const loc = wrapper && locator(wrapper.el);
    return loc ? { loc, offset: y - wrapper.r.top, height: wrapper.r.height } : null;
  };
  // Hidden at this width? Use the nearest visible sibling, then go up; never the whole body.
  const visibleNear = (el) => {
    const shown = (n) => n.getBoundingClientRect().height > 0;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (shown(n)) return n;
      for (let s = n.nextElementSibling; s; s = s.nextElementSibling) if (shown(s)) return s;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (shown(s)) return s;
    }
    return null;
  };

  let scroller = null;     // element that scrolls the content, when the page scrolls inside a container
  let syncTarget = null;   // { el, top, until } while applying a scroll that came from another frame
  let lastSync = null;     // last applied sync, re-applied after late layout (lazy images, fonts)
  let scrollQueued = false;
  let userDir = 0;         // direction of the user's last scroll step (+1 down, -1 up)
  // Only scrolling the user causes is passed on (wheel, touch, keys, scrollbar drag, or the
  // continuation of such a scroll). Scroll anchoring after late layout, page scripts and our
  // own sync are not – that is what keeps frames from pushing each other around.
  let scrollInputAt = 0;
  let userScrollAt = 0;
  const onScrollInput = (e) => { if (e.isTrusted) { scrollInputAt = Date.now(); lastSync = null; } };
  for (const t of ['wheel', 'touchmove', 'keydown', 'pointerdown']) window.addEventListener(t, onScrollInput, { capture: true, passive: true });
  const lastTop = new WeakMap();
  // A few pixels of document scroll (a body margin around a 100vh app) do not make it the page;
  // anything beyond a small margin does.
  const docScrollsMuch = () => { const d = docScroller(); return d.scrollHeight - d.clientHeight > 64; };
  document.addEventListener('scroll', (e) => {
    const el = e.target === document ? docScroller() : e.target;
    if (!(el instanceof Element)) return;
    const prevTop = lastTop.get(el);
    lastTop.set(el, el.scrollTop);
    if (syncTarget && syncTarget.el === el) {
      if (Math.abs(el.scrollTop - syncTarget.top) <= 2 || Date.now() > syncTarget.until) syncTarget = null;
      return;
    }
    const now = Date.now();
    if (now - scrollInputAt > 800 && now - userScrollAt > 150) return; // not caused by the user
    if (el !== docScroller()) {
      // Only a tall element the user scrolls vertically counts as the page's scroller
      // (apps with body{overflow:hidden}); sliders, tables and side widgets do not.
      if (el.clientHeight < innerHeight * 0.5 || (prevTop === undefined ? el.scrollTop === 0 : prevTop === el.scrollTop)) return; // horizontal
      if (docScrollsMuch()) return; // the document itself scrolls: that is the page
      scroller = el;
    }
    userScrollAt = now;
    // From the previous position of any cause, so a frame just moved by sync knows its direction.
    if (prevTop !== undefined && el.scrollTop !== prevTop) userDir = Math.sign(el.scrollTop - prevTop);
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      const max = el.scrollHeight - el.clientHeight;
      const edge = el.scrollTop <= 1 ? 'top' : el.scrollTop >= max - 1 ? 'bottom' : null;
      post('scroll', {
        ratio: max > 0 ? el.scrollTop / max : 0, edge, dir: userDir, inputAt: scrollInputAt,
        anchor: edge ? null : findAnchor(),
        container: el === docScroller() ? null : locator(el),
      });
    });
  }, { capture: true, passive: true });

  const applyScroll = (m, reapply = false) => {
    // The user touched this frame after the frame that sent this: this one leads now (the
    // dashboard learns that only from our next message, so an older one can still arrive).
    if (Number.isFinite(m.inputAt) && m.inputAt < scrollInputAt) return;
    const doc = docScroller();
    const el = (m.container && resolve(m.container)) || (!docScrollsMuch() && scroller && scroller.isConnected ? scroller : null) || doc;
    const max = el.scrollHeight - el.clientHeight;
    let top;
    if (m.edge === 'top') top = 0;
    else if (m.edge === 'bottom') top = max;
    else if (m.anchor) {
      let target = resolve(m.anchor.loc);
      let offset = +m.anchor.offset || 0;
      const hA = Math.max(1, +m.anchor.height || 1);
      if (target && target.getBoundingClientRect().height === 0) { target = visibleNear(target); offset = 0; if (!target) return; }
      if (target) {
        const r = target.getBoundingClientRect();
        // Continuous mapping: proportional inside the element (it can be taller at another
        // width), the same pixels before or after it (margins do not scale with width).
        const pos = offset < 0 ? offset : offset > hA ? r.height + (offset - hA) : (offset / hA) * r.height;
        top = el.scrollTop + r.top + pos - innerHeight * ANCHOR_Y;
      } else top = Math.max(0, Math.min(1, +m.ratio || 0)) * max; // same content not found at all
    } else top = Math.max(0, Math.min(1, +m.ratio || 0)) * max;
    top = Math.round(Math.max(0, Math.min(max, top)));
    // While the user scrolls one way, never move another frame the other way. Neighbouring
    // anchors can disagree by a few pixels (a jitter), and content in a different order at
    // this width (a sidebar placed above the text) would throw the frame back and forth.
    // The frame waits instead; the line-up after the scroll stops settles the exact position.
    const back = !reapply && m.dir && Math.sign(top - el.scrollTop) === -m.dir;
    if (!back && Math.abs(el.scrollTop - top) > 2) {
      userScrollAt = 0; // our own leftover momentum is not the user's any more
      syncTarget = { el, top, until: Date.now() + 1000 };
      el.scrollTo({ top, behavior: 'instant' });
    }
    if (!reapply) {
      // Images and fonts loading after the jump move the content: line up again twice.
      const mine = lastSync = { m };
      setTimeout(() => { if (lastSync === mine) applyScroll(m, true); }, 300);
      setTimeout(() => { if (lastSync === mine) applyScroll(m, true); }, 1500);
    }
  };

  // ---------- Performance ----------
  const vitals = { fcp: null, lcp: null, cls: 0 };
  const observe = (type, cb) => {
    try { new PerformanceObserver((list) => list.getEntries().forEach(cb)).observe({ type, buffered: true }); } catch (e) { /* unsupported */ }
  };
  observe('paint', (e) => { if (e.name === 'first-contentful-paint') vitals.fcp = e.startTime; });
  observe('largest-contentful-paint', (e) => { vitals.lcp = e.startTime; vitals.lcpEl = e.element ? describeNode(e.element) : (e.url || ''); vitals.lcpUrl = e.url || ''; });
  observe('layout-shift', (e) => { if (!e.hadRecentInput) vitals.cls += e.value; });

  const collectPerf = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    let transfer = nav ? nav.transferSize || 0 : 0;
    let unknownSize = 0;
    const byType = {};
    for (const r of res) {
      transfer += r.transferSize || 0;
      if (!r.transferSize && !r.decodedBodySize) unknownSize++;
      const t = r.initiatorType || 'other';
      byType[t] = (byType[t] || 0) + 1;
    }
    const top = (key) => res.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 8)
      .map((r) => ({ url: r.name, type: r.initiatorType, duration: Math.round(r.duration), size: r.transferSize || r.encodedBodySize || 0 }));
    // Chromium sends identical requests from several frames one after another (HTTP cache lock),
    // so the 2nd and 3rd frame wait before their request even starts. That wait belongs to the
    // bench, not to the site: measure from the moment the request could have gone out.
    // The wait shows before DNS (a new connection) or between connect and request (a reused
    // keep-alive connection); count both gaps. Waits inside redirects or for subresources are
    // not visible here – the report therefore judges timings by the fastest frame.
    const waitOf = (t) => {
      const dns = t.domainLookupStart || t.fetchStart;
      let w = Math.max(0, dns - t.fetchStart);
      if (t.requestStart && t.connectEnd) w += Math.max(0, t.requestStart - Math.max(t.connectEnd, dns));
      return w;
    };
    const queued = nav ? waitOf(nav) : 0;
    // Waits of subresources (visible for same-origin or Timing-Allow-Origin resources) and the
    // redirect hop cannot be subtracted, but the dashboard uses them to decide whether a slower
    // frame is explained by the queue.
    let resQueued = 0;
    for (const r of res) if (r.requestStart) resQueued = Math.max(resQueued, waitOf(r));
    const less = (v) => (v === null || v === undefined ? null : Math.max(0, v - queued));
    return {
      ttfb: nav ? less(nav.responseStart) : null,
      fcp: less(vitals.fcp),
      lcp: less(vitals.lcp),
      lcpEl: vitals.lcpEl || '',
      cls: vitals.cls,
      dcl: nav ? less(nav.domContentLoadedEventEnd) : null,
      load: nav && nav.loadEventEnd ? less(nav.loadEventEnd) : null,
      queued: Math.round(queued),
      resQueued: Math.round(resQueued),
      redirectMs: nav && nav.redirectEnd ? Math.round(nav.redirectEnd - nav.redirectStart) : 0,
      lcpUrl: vitals.lcpUrl || '',
      requests: res.length + 1,
      transfer,
      unknownSize,
      byType,
      domNodes: document.getElementsByTagName('*').length,
      slowest: top('duration'),
      largest: top('transferSize'),
      protocol: nav ? nav.nextHopProtocol : '',
    };
  };

  // ---------- Page check ----------
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  const accessibleName = (el) => {
    const label = (el.getAttribute('aria-label') || '').trim();
    if (label) return label;
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.textContent).join(' ').trim();
      if (t) return t;
    }
    const text = (el.textContent || '').trim();
    if (text) return text;
    const img = el.querySelector('img[alt]:not([alt=""]), svg[aria-label], [role="img"][aria-label]');
    if (img) return img.getAttribute('alt') || img.getAttribute('aria-label');
    return (el.getAttribute('title') || '').trim();
  };

  // Each reported element gets a numeric reference kept here, so the dashboard can point
  // at exactly that element later (CSS paths are ambiguous on repetitive markup).
  let refs = new Map();
  let refSeq = 0;
  let collect = false; // overlay mode: items carry the element itself and are never posted
  // A CSS selector precise enough to find the element in the source: up to a unique id or body.
  const cssPath = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      if (n.id && /^[A-Za-z][\w-]*$/.test(n.id) && document.querySelectorAll('#' + n.id).length === 1) { parts.unshift('#' + n.id); break; }
      let part = n.tagName.toLowerCase();
      const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter((c) => /^[A-Za-z_-][\w-]*$/.test(c)).slice(0, 2) : [];
      if (cls.length) part += '.' + cls.join('.');
      const parent = n.parentElement;
      if (parent && n !== document.body) {
        const same = Array.from(parent.children).filter((c) => c.tagName === n.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(n) + 1) + ')';
      }
      parts.unshift(part);
      if (n === document.body) break;
    }
    return parts.join(' > ');
  };
  const item = (el, note) => {
    if (!el) return { desc: '?', note: note || '' };
    if (collect) return { el, desc: '', note: '' };
    const ref = ++refSeq;
    refs.set(ref, new WeakRef(el));
    return { ref, desc: describeNode(el), note: note || '', path: cssPath(el), text: textHead(el).slice(0, 50) };
  };

  const audit = () => {
    if (!collect) { refs = new Map(); }
    const meta = (sel, attr = 'content') => { const el = document.querySelector(sel); return el ? (el.getAttribute(attr) || '').trim() : null; };
    const cw = document.documentElement.clientWidth;
    const all = Array.from(document.body ? document.body.getElementsByTagName('*') : []);

    // Horizontal overflow: outermost elements reaching past the viewport edge, not clipped by an ancestor.
    const overflow = [];
    const scrollW = (document.scrollingElement || document.documentElement).scrollWidth;
    if (scrollW > cw + 1) {
      const offenders = new Set();
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || (r.right <= cw + 1 && r.left >= -1)) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= cw + 1 && pr.left >= -1) { clipped = true; break; } }
          if (getComputedStyle(p).position === 'fixed') break;
        }
        if (!clipped) offenders.add(el);
      }
      for (const el of offenders) {
        if (offenders.has(el.parentElement)) continue;
        const r = el.getBoundingClientRect();
        overflow.push(item(el, Math.round(r.width) + ' px široký, přesah ' + Math.round(Math.max(r.right - cw, -r.left)) + ' px'));
        if (overflow.length >= 40) break;
      }
    }

    // Small tap targets (WCAG 2.5.8 minimum 24 × 24 px), relevant on touch viewports.
    const smallTargets = [];
    const interactive = document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [onclick]');
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || !isVisible(el)) continue;
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li, td')) continue; // links inside running text are exempt
      if (r.width < 24 || r.height < 24) smallTargets.push(item(el, Math.round(r.width) + ' × ' + Math.round(r.height) + ' px'));
      if (smallTargets.length >= 60) break;
    }

    // Tiny text.
    const tinyText = [];
    for (const el of all) {
      if (tinyText.length >= 40) break;
      if (!el.firstChild || !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12 && isVisible(el)) tinyText.push(item(el, fs + ' px'));
    }

    // Images.
    const imgs = Array.from(document.images);
    const missingAlt = [], broken = [], oversized = [];
    for (const img of imgs) {
      if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation' && img.getAttribute('aria-hidden') !== 'true') missingAlt.push(item(img, img.currentSrc || img.src));
      if (img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src)) broken.push(item(img, img.currentSrc || img.src));
      const r = img.getBoundingClientRect();
      if (img.naturalWidth && r.width > 0 && img.naturalWidth > r.width * 2.5 && img.naturalWidth > 600) {
        oversized.push(item(img, img.naturalWidth + ' px zdroj pro ' + Math.round(r.width) + ' px zobrazení'));
      }
    }

    // Form fields without a label.
    const unlabeled = [];
    for (const f of document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea')) {
      const hasLabel = (f.id && document.querySelector('label[for="' + CSS.escape(f.id) + '"]')) || f.closest('label') ||
        f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || f.getAttribute('title');
      if (!hasLabel) unlabeled.push(item(f, f.getAttribute('placeholder') ? 'jen placeholder: „' + f.getAttribute('placeholder') + '“' : (f.type || f.tagName.toLowerCase())));
    }

    // Links and buttons without an accessible name; suspicious hrefs.
    const nameless = [], badHref = [];
    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      if (!isVisible(el)) continue;
      if (!accessibleName(el)) nameless.push(item(el, el.tagName === 'A' ? el.getAttribute('href') : 'tlačítko'));
      if (el.tagName === 'A') {
        const h = el.getAttribute('href');
        if (h === '#' || /^javascript:/i.test(h) || h === '') badHref.push(item(el, h || '(prázdný)'));
      }
    }

    // Duplicate IDs.
    const ids = {};
    for (const el of document.querySelectorAll('[id]')) if (el.id) ids[el.id] = (ids[el.id] || 0) + 1;
    const dupIds = Object.entries(ids).filter(([id, n]) => id && n > 1).map(([id, n]) => item(document.getElementById(id), n + '×'));

    // Mixed content.
    const mixed = [];
    if (location.protocol === 'https:') {
      for (const el of document.querySelectorAll('[src^="http:"], link[href^="http:"][rel~="stylesheet"], iframe[src^="http:"]')) mixed.push(item(el, el.getAttribute('src') || el.getAttribute('href')));
    }

    // Headings outline.
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).slice(0, 120)
      .map((h) => ({ level: +h.tagName[1], text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 140), ref: collect ? 0 : item(h).ref, hidden: !isVisible(h) }));

    // Links for the link checker.
    const links = [];
    const seenLinks = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      const s = u.href;
      if (seenLinks.has(s)) continue;
      seenLinks.add(s);
      links.push({ url: s, text: (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80), internal: u.origin === location.origin });
      if (links.length >= 400) break;
    }

    const favicon = document.querySelector('link[rel~="icon"]');
    return {
      viewportWidth: cw,
      scrollWidth: scrollW,
      page: {
        title: document.title,
        description: meta('meta[name="description"]'),
        canonical: meta('link[rel="canonical"]', 'href'),
        robots: meta('meta[name="robots"]'),
        lang: document.documentElement.getAttribute('lang'),
        viewport: meta('meta[name="viewport"]'),
        charset: document.characterSet,
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]'),
        ogImage: (() => { const v = meta('meta[property="og:image"]'); try { return v ? new URL(v, location.href).href : null; } catch (e) { return v; } })(),
        twitterCard: meta('meta[name="twitter:card"]'),
        favicon: favicon ? favicon.href : null,
        h1: document.querySelectorAll('h1').length,
        jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
        hreflang: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
      },
      issues: { overflow, smallTargets, tinyText, missingAlt, broken, oversized, unlabeled, nameless, badHref, dupIds, mixed },
      headings,
      links,
    };
  };

  const postAudit = () => {
    try { post('audit', { audit: audit() }); } catch (e) {
      post('auditError', { message: String(e && e.message || e).slice(0, 300) });
    }
  };

  // ---------- Overlays ----------
  const overlayCss = {
    outline: '*:not(html):not(head):not(head *){outline:1px solid rgba(220,40,120,.35)!important;outline-offset:-1px!important}',
    overflow: '[data-wt-overflow]{outline:3px solid #e0245e!important;outline-offset:-3px!important;background-image:repeating-linear-gradient(45deg,rgba(224,36,94,.18) 0 6px,transparent 6px 12px)!important}',
    a11y: '[data-wt-a11y]{outline:3px dashed #e08a00!important;outline-offset:2px!important}',
    flash: '[data-wt-flash]{outline:4px solid #3b5bdb!important;outline-offset:2px!important;box-shadow:0 0 0 9999px rgba(20,30,60,.35)!important;transition:none!important}',
  };
  const styleEls = {};
  const setStyle = (name, on) => {
    if (on && !styleEls[name]) {
      const s = document.createElement('style');
      s.dataset.wtOverlay = name;
      s.textContent = overlayCss[name];
      (document.head || document.documentElement).appendChild(s);
      styleEls[name] = s;
    } else if (!on && styleEls[name]) {
      styleEls[name].remove();
      delete styleEls[name];
    }
  };
  const markAll = (attr, elements) => {
    document.querySelectorAll('[' + attr + ']').forEach((el) => el.removeAttribute(attr));
    for (const el of elements) if (el && el.setAttribute) el.setAttribute(attr, '');
  };
  const elementsOf = (keys) => {
    collect = true;
    try {
      const a = audit();
      return keys.flatMap((k) => a.issues[k].map((i) => i.el));
    } finally { collect = false; }
  };
  const overlays = { outline: false, overflow: false, a11y: false };
  const applyOverlays = () => {
    setStyle('outline', overlays.outline);
    if (overlays.overflow || overlays.a11y) {
      markAll('data-wt-overflow', overlays.overflow ? elementsOf(['overflow']) : []);
      markAll('data-wt-a11y', overlays.a11y ? elementsOf(['missingAlt', 'unlabeled', 'nameless']) : []);
    } else {
      markAll('data-wt-overflow', []);
      markAll('data-wt-a11y', []);
    }
    setStyle('overflow', overlays.overflow);
    setStyle('a11y', overlays.a11y);
  };

  let flashTimer;
  const highlight = (ref) => {
    const w = refs.get(ref);
    const el = w && w.deref();
    if (!el || !el.isConnected) { post('log', { level: 'info', source: 'bench', message: 'Web Test Bench: prvek už na stránce není, spusť kontrolu znovu.' }); return; }
    setStyle('flash', true);
    document.querySelectorAll('[data-wt-flash]').forEach((n) => n.removeAttribute('data-wt-flash'));
    el.setAttribute('data-wt-flash', '');
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.removeAttribute('data-wt-flash'); setStyle('flash', false); }, 2200);
  };

  // ---------- Commands from the dashboard ----------
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.origin !== PARENT) return;
    const m = e.data;
    if (!m || m.__wtcmd !== 1) return;
    switch (m.cmd) {
      case 'scroll': applyScroll(m); break;
      case 'overlays':
        Object.assign(overlays, m.overlays || {});
        applyOverlays();
        break;
      case 'perf': post('perf', { perf: collectPerf() }); break;
      case 'audit': postAudit(); break;
      case 'highlight': highlight(+m.ref); break;
      case 'navigate': if (/^https?:/i.test(String(m.href))) location.href = m.href; break;
      case 'reload': location.reload(); break;
      case 'back': history.back(); break;
      case 'forward': history.forward(); break;
    }
  });

  // ---------- Lifecycle ----------
  post('hello', { title: document.title });
  document.addEventListener('DOMContentLoaded', () => post('ready', { title: document.title }));
  window.addEventListener('load', () => {
    post('loaded', { title: document.title, loadTime: performance.now() });
    // Give LCP/CLS a moment to settle, then report metrics and a page check.
    setTimeout(() => {
      post('perf', { perf: collectPerf() });
      postAudit();
      if (overlays.overflow || overlays.a11y || overlays.outline) applyOverlays();
    }, 2500);
  });
})();
