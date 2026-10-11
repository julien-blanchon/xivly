<p align="center"><img src="src-tauri/icons/icon.png" width="128" height="128" alt="Xivly icon"></p>

<h1 align="center">Xivly</h1>
<p align="center"><em>Papers, without distraction.</em></p>
<p align="center">A calm, open-source PDF reader for arXiv and research papers: annotate, organize, and preview citations and figures on hover.</p>

<p align="center">
  <a href="https://github.com/julien-blanchon/xivly/releases/latest"><img src="https://img.shields.io/github/v/release/julien-blanchon/xivly?label=release&color=7fa36a" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/platforms-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux%20%C2%B7%20Web-6fa3c2" alt="macOS, Windows, Linux, Web">
  <a href="https://chromewebstore.google.com/detail/xivly/ckcfikoohhefehgbgngopbbiidnhalpi"><img src="https://img.shields.io/chrome-web-store/v/ckcfikoohhefehgbgngopbbiidnhalpi?label=chrome%20extension&color=9a82c4" alt="Chrome extension"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/julien-blanchon/xivly?color=8f8a80" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#install"><b>Download</b></a> ·
  <a href="https://julien-blanchon.github.io/xivly"><b>Open the web app</b></a> ·
  <a href="https://chromewebstore.google.com/detail/xivly/ckcfikoohhefehgbgngopbbiidnhalpi"><b>Chrome extension</b></a>
</p>

https://github.com/user-attachments/assets/c67ae97f-a1a4-4fdd-8edb-b77ba62bce72

Xivly is a reader for research papers: read, annotate and organize your PDFs, from arXiv or anywhere else. Free and open source (MIT), on Mac, Windows, Linux, the web and Chrome. No account, no tracking, no cloud: your library is a folder of plain files, and your notes are saved inside the PDFs.

## Features

- **Annotate:** highlight, box, draw, add arrows and comments, pin emoji notes, and write on the page in a handwritten font. Number keys pick the color (or the note's emoji).
- **Notes stay in the PDF:** annotations are standard PDF annotations, so a shared paper opens with your notes in Preview, Acrobat or any PDF app. Export your notes as Markdown, copy a BibTeX entry.
- **Never lose your place:** hover a citation, a figure, a table or an equation to preview it; jump to every place an equation is mentioned and back. Right-click an equation or figure to box it, copy it or save it as an image.
- **Find your way around a paper:** side panels for contents, pages, figures, tables, equations, references and your notes; find in the paper with every match listed.
- **Add papers in one step:** search Hugging Face or paste an arXiv link, drop PDFs, or right-click a paper on the web: *Open in Xivly* (Chrome extension). Titles, authors, links to code, project pages and Hugging Face models and Spaces are filled in for you.
- **Organize:** categories, tags, read / unread, archive, sort and search across your library.
- **Read comfortably:** reading themes that tint the page by category, light and dark, one page, two pages or scroll sideways, and it reopens where you left off. A keyboard shortcut for everything (`?` lists them).
- **Yours, as plain files:** each paper is a folder with `paper.pdf` and `paper.json`, in any folder you choose (iCloud Drive, Dropbox, a git repo…). Scripts and coding agents can read and extend it (below).

## Screenshots

<table>
<tr><td width="50%"><img src="docs/media/library.jpg" alt="Your library: categories, tags, read and unread"><br><sub>Your library: categories, tags, read and unread</sub></td><td width="50%"><img src="docs/media/hf-search.jpg" alt="Add a paper from a Hugging Face search"><br><sub>Add a paper from a Hugging Face search</sub></td></tr>
<tr><td width="50%"><img src="docs/media/handwritten.jpg" alt="Write on the page; the page tint follows the category"><br><sub>Write on the page; the page tint follows the category</sub></td><td width="50%"><img src="docs/media/citation.jpg" alt="Hover a citation: the paper, and one click to add it"><br><sub>Hover a citation: the paper, and one click to add it</sub></td></tr>
<tr><td width="50%"><img src="docs/media/figure-preview.jpg" alt="Hover a figure reference to preview the figure"><br><sub>Hover a figure reference to preview the figure</sub></td><td width="50%"><img src="docs/media/panels-find.jpg" alt="Find in the paper, with every match listed"><br><sub>Find in the paper, with every match listed</sub></td></tr>
<tr><td width="50%"><img src="docs/media/sideways.jpg" alt="One page, two pages, or scroll sideways"><br><sub>One page, two pages, or scroll sideways</sub></td><td width="50%"><img src="docs/media/preview-app.jpg" alt="Share it: your notes open in any PDF app"><br><sub>Share it: your notes open in any PDF app</sub></td></tr>
</table>

## Install

| | |
|---|---|
| **macOS** 26.2+ | `brew install --cask julien-blanchon/tap/xivly`, or the `.dmg` from [Releases](https://github.com/julien-blanchon/xivly/releases). Signed and notarized. |
| **Windows** 10/11 | the `.exe` (or `.msi`) from [Releases](https://github.com/julien-blanchon/xivly/releases). Not code-signed yet: SmartScreen asks once (*More info → Run anyway*). |
| **Linux** x86_64 | `curl -fsSL https://raw.githubusercontent.com/julien-blanchon/xivly/main/install.sh \| sh` (picks the `.deb`, `.rpm` or AppImage for your system and checks it), or download one from [Releases](https://github.com/julien-blanchon/xivly/releases). Needs glibc 2.39+ (Ubuntu 24.04, Debian 13, Fedora 40 or newer). |
| **Web** | [julien-blanchon.github.io/xivly](https://julien-blanchon.github.io/xivly), in a recent Chrome, Edge, Arc or Safari 26.2. |
| **Chrome extension** | [Chrome Web Store](https://chromewebstore.google.com/detail/xivly/ckcfikoohhefehgbgngopbbiidnhalpi) (Chrome, Edge, Brave, Arc 145+): the web app, plus *Open in Xivly* on arXiv pages and PDF links. |

Updates: `brew upgrade --cask xivly` on macOS, re-run the install line on Linux, otherwise download the new release (there is no auto-update).

## Your library is a folder

Xivly only writes plain files in the folder you pick:

```
<library>/
  AGENTS.md / CLAUDE.md       explains the layout to Claude Code, Codex, …
  .xivly/library.json         categories and tags
  .xivly/hooks/               your scripts, run on events (desktop)
  papers/<year>-<title>/
    paper.pdf                 your annotations live inside the PDF
    paper.json                title, authors, year, abstract, DOI, arXiv, links, category, tags
```

Open the folder in Claude Code and ask it about your papers and highlights. Unknown fields in `paper.json` are kept, so agents and scripts can add their own.

**Hooks (desktop):** drop a script named after an event in `.xivly/hooks/` (`paper-added`, `paper-saved`, `paper-updated`, `paper-removed`; `paper-added.py` works too). It runs in the paper's folder with `paper.json` on stdin; output goes to `.xivly/logs/hooks.log`. Executables or `.sh` on macOS and Linux, `.ps1`, `.cmd` or `.bat` on Windows. Xivly never writes hook scripts itself (only a `.sample`), so enabling one is always your choice.

## Compared with…

- **Zotero, Mendeley:** reference managers first, with a reader inside. Xivly is a reader first, with a light library around it. No account, no database: notes are standard annotations in the PDF and metadata is a JSON file next to it.
- **Sioyek:** also built for papers, keyboard-driven, with reference previews. Xivly adds a library (categories, tags, read / unread), one-step arXiv and Hugging Face import, annotations saved in the PDF itself, and it runs on the web too.
- **Skim, Preview, PDF Expert, Acrobat:** general PDF apps. Xivly understands papers: citations, figures, tables and equations preview on hover, and side panels list each of them.

## FAQ

- **Is it free?** Yes, MIT licensed. No account, no subscription, no tracking ([PRIVACY.md](PRIVACY.md)).
- **Only arXiv papers?** No: drop any PDF. arXiv links and Hugging Face search just fill in the details for you.
- **Where are my notes?** Inside the PDF, as standard annotations. Open the file in any PDF app and they are there.
- **How do I sync between machines?** Put the library folder in iCloud Drive, Dropbox, Syncthing or a git repo.
- **Can I leave?** Nothing to export: the folder of PDFs and JSON files is the library.

## More

- [DEVELOPMENT.md](DEVELOPMENT.md): architecture, running and testing it, the Chrome extension, the example library, releases.
- [RELEASING.md](RELEASING.md): the release workflow and store publishing.
- [PRIVACY.md](PRIVACY.md) · [CODE_SIGNING.md](CODE_SIGNING.md)
- Built on [svelte-pdf-mini](https://github.com/julien-blanchon/svelte-pdf-mini), my Svelte library for PDF reading and annotation.

## Contributing

Bug reports and ideas are welcome in [Issues](https://github.com/julien-blanchon/xivly/issues). If Xivly is useful to you, a ⭐ helps other people find it.

MIT License.
