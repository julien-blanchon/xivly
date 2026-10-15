# Developing Xivly

How the codebase is organized, how to run and test it, and how the Chrome extension, the example library and releases are built. For using Xivly, see the [README](README.md).

## Three targets, one codebase

| | Desktop (Tauri) | Web (GitHub Pages) and Chrome extension |
|---|---|---|
| Library folder | any folder (Rust, `src-tauri/src/library.rs`) | any folder via File System Access API (Chrome/Edge/Arc); browser storage (OPFS) elsewhere |
| Delete | Trash / Recycle Bin | `.xivly/trash/` |
| Hooks | ✅ | — (browsers can't run scripts) |
| Show in Finder / Explorer / Files | ✅ | — |

Everything else (library logic, metadata extraction, reader, annotations) is shared TypeScript. The platform is detected at runtime (`src/lib/platform/`); the web build differs only by its base path, the extension by its build flag (below).

```
src/lib/platform/   LibraryFs + Platform interface; tauri.ts / web.ts adapters
src/lib/extension/  Chrome extension only: service worker, arXiv content script, "Open in Xivly"
src/lib/repo.ts     library layout, paper.json merge, import, save (shared)
src/lib/extract.ts  metadata extraction (svelte-pdf-mini analyzePaper + links/year)
src/lib/library.svelte.ts   app state (filters, search, categories, tags)
src/routes/         library (/) and reader (/read?id=…)
src-tauri/          thin Rust: fs primitives confined to the library, hooks, quit handshake
```

The desktop webview runs under a strict Content Security Policy (`src-tauri/tauri.conf.json`): only the services Xivly talks to (arXiv, Hugging Face, Semantic Scholar, OpenAlex, Crossref, the example library on Pages) are reachable.

## Develop

```sh
bun install
bun run tauri dev        # desktop
bun run dev              # web, http://localhost:1420
bun run check            # svelte-check
bun run test             # unit tests (Vitest)
bun run test:e2e         # end-to-end smoke test: the web build in Chromium (Playwright)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust tests
bun run build:web        # static build for Pages (BASE_PATH=/xivly)
bun run build:extension  # Chrome extension: build-extension/ (unpacked) + dist/Xivly_<version>_chrome.zip
bun run dev:extension    # the same, unpacked, rebuilt on every change (live reload)
```

The e2e test (`tests/`) runs in Playwright's Chromium (`bunx playwright install chromium` once), or in another Chromium 145+ given by `XIVLY_E2E_BROWSER`, e.g. `XIVLY_E2E_BROWSER="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"`. The Rust side embeds the built frontend: `cargo test` and `cargo clippy` need a `build/` (`bun run build`).

To hack on svelte-pdf-mini at the same time: `cd ../svelte-pdf-mini/packages/svelte-pdf-mini && bun link`, then `bun link svelte-pdf-mini` here. Vite caches dependencies in memory: restart the dev server after rebuilding the library.

On macOS, `tauri dev` runs the app inside a small `Xivly Dev.app` wrapper (`scripts/dev-app.sh`) so it has a bundle identifier (`cc.blanchon.xivly.dev`): clipboard history apps then record its copies, and its data stays apart from the installed app.

## Chrome extension

The web app as an extension page (`chrome-extension://<id>/index.html`), from the same code: `bun run build:extension` builds it with `XIVLY_EXTENSION=1`, which

- switches SvelteKit to its hash router (`index.html#/read?id=…`: an extension is plain files, with no fallback page for `/read`) and its app folder to `app/` (Chrome reserves names starting with `_`), in `vite.config.js`;
- sets `__XIVLY_EXTENSION__` (`vite.config.js`), which gates the extension's own code (`src/lib/extension/`): the web and desktop bundles leave it out;
- then `scripts/build-extension.ts` moves SvelteKit's inline bootstrap script to `boot.js` (extension pages only run scripts from the package), bundles the service worker and the content script, renders the icons from `src-tauri/icons/icon.svg`, writes `manifest.json` from `package.json`'s version and zips it all.

What it adds to the web app:

- The toolbar button opens the library, or focuses the tab that shows it.
- **Open in Xivly** (right-click an arXiv abstract / PDF page or link, an alphaXiv or Hugging Face paper page, or any `.pdf` link; the link next to *View PDF* on arXiv abstract pages; or the toolbar button's menu, *Open this tab in Xivly*, e.g. on a PDF open in Chrome): adds the paper (arXiv papers the same way as pasting their link) and opens it in the reader. An arXiv paper or a link already in the library just opens. All of them open `index.html#/?add=<link>` (`src/lib/open-url.svelte.ts`, shared with the web app's `/?add=`; the extension adds the site permission prompt below and focuses a reader already showing the paper).
- **arXiv PDFs open in Xivly** instead of Chrome's viewer (*Settings › Library*, on by default): the service worker watches arXiv tabs' URLs (`tabs.onUpdated`) and points a tab that shows `arxiv.org/pdf/…` at `#/?add=`. Only top-level navigations: Xivly's own downloads of the PDF are `fetch`es. The PDF stays in the tab's history: *Back* from Xivly shows it in Chrome's viewer rather than redirecting again (until the tab shows another arXiv page). The setting lives in the app's `localStorage`, which the service worker can't read: the app mirrors it into `chrome.storage.local`.

The content script (`src/lib/extension/content.ts`, on `arxiv.org/abs/*`) only adds that link; the click sends a message, and the service worker opens the page's URL (the message's sender).

Permissions: `contextMenus`, `activeTab` and `storage` (no install warning); site access to `*.arxiv.org` (`host_permissions`, for the content script and to see arXiv tabs' URLs: *Read and change your data on all arxiv.org sites*, the only install warning). Sites that let other sites download their PDFs (arXiv, most hosts with CORS) need nothing else; for the others Xivly asks first, then Chrome asks for that one site (`optional_host_permissions`). Nothing is read from pages but arXiv tabs' URLs, and no PDF is opened in Xivly unless you ask (or open an arXiv PDF, with the setting on). A release that adds an install warning disables the extension for existing users until they accept it.

To try it: `bun run dev:extension`, then `chrome://extensions` → *Developer mode* → *Load unpacked* → `build-extension/`, once. It rebuilds on every change in `src/` or `static/` (about 5 s): open Xivly tabs reload by themselves, and the whole extension reloads (its tabs reopened) when the service worker or the manifest changes. After `bun run build:extension`, use the reload button on the extension's card instead. Inspect the service worker from that card, the app with the usual DevTools. The library folder is picked as on the web; Chrome keeps the extension's library (and its folder access) apart from the website's.

Publishing to the Chrome Web Store is part of the release workflow once set up (a one-time $5 developer fee): see [RELEASING.md](RELEASING.md#chrome-web-store-one-time-setup).

## Example library

On first start, Xivly offers a ready-made library of annotated papers (all tagged `#demo`). Its source is `starter/papers.json`: per paper, a category, tags, read state, and annotations anchored by quote or by figure / table / equation label. To rebuild it:

```sh
scripts/starter-pdfs.sh        # download + safely compress the PDFs into starter/pdfs/
bun run dev                    # then open /dev/starter and click "Build starter.zip"
gh release upload starter starter.zip --clobber   # the Pages deploy serves it at /xivly/starter/
```

In dev, the app reads the example library from `starter/build/` (unzip `starter.zip` there); it is never part of the app bundle.

## Release

```sh
bun run release 0.2.0 && git push --follow-tags
```

The `release` workflow builds the macOS (universal; app and DMG signed, notarized and stapled), Windows (`.exe`, `.msi`) and Linux (`.AppImage`, `.deb`, `.rpm`) apps and the Chrome extension (`_chrome.zip`) into one GitHub Release, publishes it once every build is there, then bumps `Casks/xivly.rb` in `julien-blanchon/homebrew-tap` and, once set up, submits the extension to the Chrome Web Store. Release svelte-pdf-mini first when Xivly needs a new version of it. Details, secrets and troubleshooting: [RELEASING.md](RELEASING.md). `ci` checks the web app (type check, unit tests, knip, the e2e smoke test; it also builds the Chrome extension) and the Rust side on macOS, Windows and Linux; the `pages` workflow deploys the web version from `main` once `ci` passed on it; `cache` keeps the release builds' Rust cache warm. Dependabot proposes dependency updates weekly.
