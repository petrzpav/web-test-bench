# Chrome Web Store listing

Everything the Chrome Web Store developer dashboard asks for, ready to paste. Build the package with `npm run pack`; the ZIP is written to `dist/`.

## Package

- File: `dist/web-test-bench-<version>.zip`
- Version: from `manifest.json`

## Store listing

- **Name:** Web Test Bench (from the manifest)
- **Summary:** from `_locales/*/messages.json` (English and Czech)
- **Category:** Developer Tools
- **Language:** English (default); add Czech as a second listing language
- **Icon:** `icons/128.png`
- **Screenshots (1280×800):**
  - English: `docs/store/en-1-overview.png` … `en-4-report.png`
  - Czech: `docs/store/cs-1-overview.png` … `cs-4-report.png`
- **Small promo tile (440×280):** `docs/store/promo-440x280.png`
- **Homepage URL:** https://github.com/petrzpav/web-test-bench
- **Support URL:** https://github.com/petrzpav/web-test-bench/issues

### Description (English)

```
Test a web page as a phone, a tablet and a desktop at once, and get one report of everything that is wrong.

Web Test Bench opens any page in three frames side by side, so you can see the mobile, tablet and desktop layout together. Scrolling and clicking in one frame moves the others to the same content. A panel at the bottom collects what you would otherwise dig out of DevTools, for each size separately:

• Console: errors, warnings and exceptions, deduplicated and marked with the sizes where they happened
• Network: failed and slow requests
• Performance: TTFB, FCP, LCP, CLS and load time per size, rated by the Core Web Vitals thresholds
• Page check: horizontal overflow with the exact elements that cause it, small tap targets, tiny text, oversized and broken images, images without alt, form fields without labels, duplicate ids, mixed content
• Page metadata: title, description, H1, language, viewport, robots, canonical, Open Graph, favicon
• Link checker, a manual-testing checklist and notes kept per site
• Report as Markdown or JSON, ready for an issue or for an AI agent

Highlights in the page show element outlines, overflowing elements and accessibility problems. You can pick any device size, rotate, hide or reorder the frames, and take screenshots.

Built for AI agents too: a command-line tool in the GitHub repository runs the same bench headless and prints the report, so an agent does not need screenshots to see what is broken.

Works with local dev servers (localhost, 127.0.0.1, *.test). Open it with the toolbar button or Alt+Shift+T. Interface in English and Czech.

Privacy: no server, no analytics, nothing leaves your browser. To show any site in its frames, the extension removes framing headers only for frames inside its own tab, and only while it is open.

Open source (MIT): https://github.com/petrzpav/web-test-bench
```

### Description (Czech)

```
Otestujte stránku jako telefon, tablet a desktop najednou a získejte jednu zprávu se vším, co je špatně.

Web Test Bench otevře libovolnou stránku ve třech rámech vedle sebe, takže vidíte rozložení pro mobil, tablet i desktop zároveň. Posun a klikání v jednom rámu přenese ostatní na stejný obsah. Panel dole sbírá pro každou velikost zvlášť to, co byste jinak hledali v DevTools:

• Konzole: chyby, varování a výjimky bez duplicit, s označením velikostí, kde nastaly
• Síť: neúspěšné a pomalé požadavky
• Výkon: TTFB, FCP, LCP, CLS a doba načtení pro každou velikost, hodnocené podle hranic Core Web Vitals
• Kontrola stránky: vodorovný posun i s prvky, které ho způsobují, malé dotykové cíle, drobný text, zbytečně velké a nenačtené obrázky, obrázky bez alt, pole bez popisku, duplicitní id, smíšený obsah
• Metadata: titulek, popis, H1, jazyk, viewport, robots, kanonická URL, Open Graph, favicon
• Kontrola odkazů, kontrolní seznam pro ruční test a poznámky ke každému webu
• Zpráva v Markdownu nebo JSON, připravená do issue nebo pro AI agenta

Zvýraznění ve stránce ukáže obrysy prvků, přetékající prvky a problémy přístupnosti. Velikosti jde libovolně měnit, rámy otáčet, skrývat a přeskládat a ukládat snímky.

Připraveno i pro AI agenty: nástroj pro příkazovou řádku v repozitáři na GitHubu spustí stejný panel bez okna a vypíše zprávu, takže agent nepotřebuje snímky obrazovky.

Funguje s lokálními servery (localhost, 127.0.0.1, *.test). Otevře se tlačítkem na liště nebo Alt+Shift+T. Rozhraní česky a anglicky.

Soukromí: žádný server, žádná analytika, nic neopouští prohlížeč. Aby šlo zobrazit libovolný web, rozšíření odstraňuje hlavičky proti vkládání jen u rámů ve vlastní záložce a jen dokud je otevřená.

Open source (MIT): https://github.com/petrzpav/web-test-bench
```

## Privacy practices tab

**Single purpose**

```
Test a web page at several screen sizes at once: show it in three frames side by side and report its console errors, failed requests, performance and layout problems for each size.
```

**Permission justifications**

- **declarativeNetRequest:**

  ```
  To show the page under test in the bench's frames, a session rule removes the X-Frame-Options and Content-Security-Policy response headers. The rule is limited to sub-frames of the bench tab (tabIds condition) and is removed when the bench is closed or navigated away.
  ```

- **webRequest:**

  ```
  Read-only observation of the tested page's requests (status, timing, size, errors) to list failed and slow requests per screen size in the Network tab and in the report. Requests are not blocked or modified.
  ```

- **storage:**

  ```
  Stores the user's settings (sizes, zoom, panel layout), the last tested addresses and the per-site checklist and notes locally in chrome.storage.local.
  ```

- **Host permission (`<all_urls>`):**

  ```
  The user can test any website, including local development servers. The extension needs to load the chosen site in its frames, run its measuring content script inside those frames (it exits immediately on any page that is not a frame of the bench tab), observe the requests, and check the page's links when the user asks for it.
  ```

- **Remote code:** No. All code is in the package.

**Data usage**

- Recommended answer: no user data is collected, because nothing is sent off the device; see PRIVACY.md. This is a recommendation, not a verified reading of the store's rules: check the form's definitions before answering.
- Then tick the three certifications. They cover selling data, using it for unrelated purposes, and using it for creditworthiness.

**Privacy policy URL**

```
https://github.com/petrzpav/web-test-bench/blob/main/PRIVACY.md
```

## Distribution

- **Visibility:** Public.
- **Regions:** All regions.
