# Privacy policy

Web Test Bench is a browser extension for testing web pages. This policy covers the extension and the `tools/wtb.mjs` command-line tool in this repository.

**Web Test Bench does not collect, send or sell any data.** It has no server, no account, no analytics and no tracking.

## What it reads, and only while you use it

When you open a page in the bench, the extension loads that page in three frames and reads, inside your browser, what a tester would look at:

- the page's console messages,
- its network requests,
- its performance timings,
- its page structure: elements, links, headings and meta tags.

It does this only in the frames of the bench tab. On every other tab, the extension's scripts check that they are not in the bench and stop at once.

## What it stores

These items are kept in your browser's extension storage (`chrome.storage.local`) and never leave your computer:

- your settings: sizes, zoom, panel layout, switches,
- the last 25 addresses you tested, for the address bar suggestions,
- the checklist and notes you write for each site,
- the chosen interface language (in the extension's `localStorage`).

Removing the extension deletes all of it.

## What it sends

Nothing is sent to the developer or to any third party. The only network requests the extension makes are these, both started by you:

- **Loading the page you entered.** The bench loads it in its frames, as a normal tab would.
- **The link checker.** When you start it, it requests the links found on the tested page to see whether they work. It sends no cookies with these requests.

## Permissions

- **Access to all sites.** This is needed to show any site you choose in the bench frames, measure it and check its links.
- **`declarativeNetRequest`.** This removes the `X-Frame-Options` and `Content-Security-Policy` response headers so that sites can be shown in the frames. The rule applies only to frames inside the bench tab, and only while the bench is open.
- **`webRequest`.** This reads the status and timing of the tested page's requests for the Network tab. It does not change them.
- **`storage`.** This keeps the settings, history and notes listed above.

## Contact

Questions and reports: <https://github.com/petrzpav/web-test-bench/issues>
