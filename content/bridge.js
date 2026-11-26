// Isolated world. Runs only inside a frame placed directly in the Web Test Bench
// dashboard; tells the dashboard which Chrome frameId belongs to which viewport,
// so network events from chrome.webRequest can be attributed to it.
(() => {
  const ao = location.ancestorOrigins;
  if (!ao || ao.length !== 1 || ao[0] !== 'chrome-extension://' + chrome.runtime.id) return;
  const m = /^wt-(\w+)/.exec(window.name);
  if (!m) return;
  chrome.runtime.sendMessage({ type: 'wt-hello', vp: m[1], url: location.href }).catch(() => {});
})();
