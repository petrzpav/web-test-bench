---
name: web-test-bench
description: "Test a web page at mobile, tablet and desktop sizes from the terminal with Web Test Bench and get one report: console errors and failed requests per viewport, load performance (TTFB, FCP, LCP, CLS), horizontal overflow with the offending elements, small tap targets, tiny text, oversized images, missing alt or labels, SEO and meta checks, and broken links. Activate when asked to test, check or review a website or a page, after changing a page's frontend (layout, CSS, JS) to verify it on mobile, when asked whether a page is responsive, broken on a phone, slow, or throwing errors, or before taking screenshots at several sizes to judge a layout."
metadata:
  author: petrzpav
---
# Web Test Bench

Web Test Bench is a Chrome extension. Its repository is the parent folder of this skill's folder (`skill/`); when the skill is installed as a symlink, find it with `dirname "$(readlink -f ~/.claude/skills/web-test-bench)"`. Below, `$WTB` stands for that folder. The extension loads a page in three viewport frames and measures everything a manual tester would check. Its CLI runs it headless and prints the result. Use it instead of taking screenshots at several sizes or reading DevTools: the report already says what is wrong, at which size, and on which element.

## Run it

```sh
WTB=$(dirname "$(readlink -f ~/.claude/skills/web-test-bench)")
node "$WTB/tools/wtb.mjs" <url> --lang en             # Markdown report
node "$WTB/tools/wtb.mjs" <url> --lang en --json      # same data as JSON
node "$WTB/tools/wtb.mjs" <url> --lang en --links     # also check every link on the page
node "$WTB/tools/wtb.mjs" <url> --lang en --shots /tmp/shots   # plus full-page PNG per size
node "$WTB/tools/wtb.mjs" <url> --lang en --sizes 390x844,820x1180,1920x1080
```

- **Language.** Always pass `--lang en`; the report is then in English, as described below. Without it the language follows `LANG` in the terminal (`--lang cs` gives Czech).
- **URLs.** Local dev servers work: `localhost:8000`, `127.0.0.1:5173`, `*.test`. A URL without a scheme gets `http://` for local hosts and `https://` otherwise.
- **Speed.** A run takes about 5–10 s.
- **`--timeout <s>`.** Default 45 s. Raise it for slow pages; an incomplete run says "the measurement did not finish" and exits 1.
- **Exit codes.**
  - `0`: no serious finding.
  - `1`: at least one serious finding (`✗`), or the measurement did not finish.
  - `2`: the tool itself failed (missing Chromium or `playwright-core`, invalid URL).
- **Serious findings (`✗`):** console errors, failed requests, a document with HTTP 4xx/5xx, a page that did not load or could not be measured, horizontal overflow, broken or mixed-content images, poor Core Web Vitals or TTFB, a page check that could not run, `noindex` or a missing title or viewport, and broken links. A large DOM, small tap targets, tiny text, missing alt or labels and missing meta tags are `⚠` only.
- **First use or exit code 2 about `playwright-core`:** run `npm install` in `$WTB`.
- **Missing Chromium:** run `npx playwright install chromium`. Google Chrome cannot be used: it ignores `--load-extension`.

## Read the report

Sections of the report, in order:

1. **Result** and **Key findings.** Start here.
   - `✗` lines are serious and `⚠` lines are worth fixing.
   - `no serious problems` means the page passed (JSON: `passed: true`).
   - `the measurement did not finish` means the data is incomplete; rerun with a longer `--timeout`.
2. **Performance.** TTFB, FCP, LCP, CLS, DOMContentLoaded, Load, request count, transferred bytes and DOM size per viewport.
   - `✗` means poor and `⚠` means needs improvement, by Core Web Vitals thresholds.
   - The three frames load at the same time, and the browser sends identical requests from them one after another. The document's waiting time is subtracted (`queuedMs` in JSON); waits behind redirects or subresources cannot be.
   - So a frame is judged by another frame that measured the same thing faster, but only when the measured waiting (queued subresources, a longer redirect hop) explains the difference: TTFB and FCP by any frame, LCP only by a frame with the same LCP element and file. A line "slow …, the same thing was faster in another frame" (and `(queue)` in the table) most likely means the bench queue, not the site. A slow LCP on a different element, such as a mobile-only hero image, stays a real finding.
   - Treat timings as indicative. Compare them between runs, not against production numbers.
3. **Problems by size.** Counts per viewport, then each viewport's elements. Each element is given as a CSS selector path, its first text and a detail, for example `` `main > section:nth-of-type(4) > ul > li:nth-of-type(3) > a “Pricing” (2500 px wide, overflows by 2165 px)` ``. Issue types:
   - *Horizontal scroll*: elements wider than the screen.
   - *Small tap targets*: under 24 × 24 px.
   - *Tiny text*: under 12 px.
   - *Oversized images*: source more than 2.5× its display width.
   - *Images without alt*, *Form fields without a label*, *Links and buttons without text*, *Duplicate ids*, *Mixed content*, *Broken images*.
4. **Page.** Title and description length, H1 count, `lang`, meta viewport, robots (`noindex` is flagged), canonical, Open Graph, favicon.
5. **Console.** Errors and warnings, deduplicated, with the viewports where each happened, its count and its source location.
6. **Failed requests.** 4xx/5xx and network failures, deduplicated across viewports.
7. **Links.** Only with `--links`. Broken links. Links that look like logout or delete are skipped on purpose.
8. **Checklist / Notes from manual testing.** The manual checklist and notes the user saved for that host in the browser extension. Left out when unused, so a CLI run does not have this section.

In JSON (`--json`):

- `passed` is the overall verdict and `ready` says whether the measurement finished.
- `language` is `en` or `cs`, and `findings` holds the verdict lines as `{ severity: "bad" | "warn", text }`.
- `viewports.<mobile|tablet|desktop>` holds:
  - `status`: `ok`, `error`, `timeout`, `loading` or `not-measured`,
  - `httpStatus`, `loadMs`, `horizontalOverflowPx`, `perf`, `slowestResources`, `largestResources`,
  - `ratings` (judged, used for the verdict), `rawRatings` (by thresholds only), `queueLimited` (metrics judged by a faster frame), `queuedMs`, `resQueuedMs`, `redirectMs` and `lcpUrl`,
  - Limit: a slow, uncacheable stylesheet from another origin without `Timing-Allow-Origin` hides its waiting, so a slower second or third frame can then show `✗`. Use the extension's "Measure again" to measure that frame alone.
  - `issues.<key>.items[]` as `{ path, text, note, element, ref }`.
- `console`, `failedRequests`, `links.broken` and `page.checks` hold the other sections.

## How to use it while working

- **Verify a frontend change.** Run it on the changed page, fix what the findings name, and run it again until the findings are gone or explained. Mention the before and after findings in your summary.
- **Overflow on mobile.** The selector path names the offender. Search the templates and CSS for its classes or its text instead of guessing.
- **Errors in only one viewport.** These point to width-dependent code: breakpoint JS, `matchMedia`, lazy loading. Errors in all three point to the page itself.
- **Looks are not covered.** Colours, spacing and visual taste are not in the report. When those matter, add `--shots <dir>` and read the PNGs. Do not take screenshots just to look for errors or overflow; the report already has them.
- **One viewport sanity check.** Use `--sizes` to test the user's target devices, for example `--sizes 360x780,768x1024,1920x1080`.

## Limits

- The frames emulate the viewport size, so CSS breakpoints and layout are tested. The user agent sent to the server, device pixel ratio and touch events are not emulated.
- Inside the frames, page JavaScript only sees `SameSite=None` cookies. Pages behind a login need a session cookie the server accepts; the CLI starts with an empty profile.
- Service workers are disabled in the frames. CSP is stripped so any site can be framed, so CSP violations are not reported.

## The extension for people

The user runs the same bench interactively. Open it with the toolbar button or Alt+Shift+T. Its **Report** tab (**Zpráva** in Czech) shows this report and has Copy Markdown and Copy JSON buttons. The interface follows the browser language or the choice in its settings, so a pasted report may be in Czech; read it the same way.
