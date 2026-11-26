// Toolbar button: open the bench in a new tab with the current page's URL.
chrome.action.onClicked.addListener((tab) => {
  const isWeb = tab.url && /^https?:\/\//.test(tab.url);
  const target = chrome.runtime.getURL('dashboard.html') + (isWeb ? '?url=' + encodeURIComponent(tab.url) : '');
  chrome.tabs.create({ url: target, index: tab.index + 1 });
});

// The dashboard adds a session rule scoped to its own tab that lets sites be framed.
// Remove it when that tab goes away so no other tab is ever affected.
const removeRule = (tabId) => chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {});
chrome.tabs.onRemoved.addListener(removeRule);
// Backup for the dashboard's own pagehide handler: if the tab navigates to a web page,
// the rule must not keep stripping framing protection there.
const DASHBOARD = chrome.runtime.getURL('dashboard.html');
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url && !info.url.startsWith(DASHBOARD)) removeRule(tabId);
});
