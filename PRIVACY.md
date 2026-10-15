# Privacy

Xivly (the desktop app, the web app and the Chrome extension) collects no personal data. There is no account, no analytics, no telemetry and no Xivly server.

## What stays on your device

Your papers, annotations, notes, tags and settings are stored only on your device: in the library folder you choose, or in the browser's private storage (the web app and the extension). Nothing is uploaded anywhere.

## Network requests

Xivly only connects to other sites when you ask it to:

- **Adding a paper**: the PDF is downloaded from where it lives (arXiv for an arXiv paper, or the PDF link you chose with *Open in Xivly*).
- **Paper details**: for arXiv papers, Xivly asks Hugging Face's public papers API (`huggingface.co/api/papers/<arXiv id>`) for the paper's page, upvotes and links. Only the arXiv id is sent.
- **Example library**: if you choose to add the example papers, they are downloaded from Xivly's website (`julien-blanchon.github.io/xivly`).

These sites receive ordinary web requests (your IP address, browser type), as when you visit them yourself, under their own privacy policies.

## Chrome extension permissions

- **contextMenus**: the *Open in Xivly* menu item on paper pages and PDF links.
- **activeTab**: when you use *Open this tab in Xivly* from the toolbar button's menu, Xivly reads that tab's address, once, to download its PDF.
- **Site access to arxiv.org**: an *Open in Xivly* link on arXiv abstract pages, and arXiv PDFs opening in Xivly instead of Chrome's PDF viewer (Settings › Library turns that off). For this, Xivly sees the address of your arXiv tabs only, and keeps none of them.
- **storage**: that setting, stored in the browser for the extension's background script.
- **Optional site access**: only when a site doesn't allow other sites to download its PDFs, Chrome asks you to allow Xivly on that one site. It is only used to download the PDFs you open in Xivly.

The extension reads nothing from the pages you visit (on arXiv abstract pages, it only adds its link), and does not track your browsing.

## Contact

Questions: [open an issue](https://github.com/julien-blanchon/xivly/issues).
