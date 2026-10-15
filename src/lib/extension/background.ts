/// <reference types="chrome" />
// Chrome extension service worker (bundled on its own by scripts/build-extension.ts).
//
// The app itself is index.html, the web build in an extension page: this only
// opens it. The toolbar button shows the library (an open one is focused), and
// "Open in Xivly" (a paper's page or link, or the link on arXiv abstract pages,
// ./content.ts) opens a new tab that adds the paper, then shows it in the
// reader (see ./app.svelte.ts). arXiv PDFs open in Xivly instead of Chrome's
// viewer (a setting).
import { PAPER_URLS, focusLibraryTab, type ExtensionMessage } from './messages';

const app = (hash = '') => chrome.runtime.getURL(`index.html${hash}`);
/** The app adds the paper at `url`, then reads it. */
const adding = (url: string) => app(`#/?add=${encodeURIComponent(url)}`);

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({ id: 'link', title: 'Open in Xivly', contexts: ['link'], targetUrlPatterns: PAPER_URLS });
		chrome.contextMenus.create({ id: 'page', title: 'Open in Xivly', contexts: ['page'], documentUrlPatterns: PAPER_URLS });
		// Chrome's PDF viewer may not show the page menu: the toolbar button's menu
		// works on any tab (its click grants activeTab, which reveals the tab's URL).
		chrome.contextMenus.create({ id: 'tab', title: 'Open this tab in Xivly', contexts: ['action'] });
	});
});

// bun run dev:extension: a reload closes the extension's tabs; reopen them.
if (__XIVLY_EXTENSION_DEV__)
	void chrome.storage.local.get('reopen').then(({ reopen }) => {
		for (const url of (reopen as string[] | undefined) ?? []) void chrome.tabs.create({ url });
		void chrome.storage.local.remove('reopen');
	});

chrome.action.onClicked.addListener(() => void showLibrary());

chrome.contextMenus.onClicked.addListener((info, tab) => {
	const url = info.menuItemId === 'link' ? info.linkUrl : info.menuItemId === 'page' ? (info.frameUrl ?? info.pageUrl) : tab?.url;
	if (url) openInXivly(url, tab);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
	if (message.type === 'open-page' && sender.url) openInXivly(sender.url, sender.tab, !message.background);
});

/** A new tab next to `tab` adds the paper at `url` and reads it. */
function openInXivly(url: string, tab?: chrome.tabs.Tab, active = true) {
	void chrome.tabs.create({ url: adding(url), active, index: tab ? tab.index + 1 : undefined, openerTabId: tab?.id });
}

// ── arXiv PDFs open in Xivly (Settings › Library; mirrored into storage by the app) ──
// tabs.onUpdated tells the URL of arXiv tabs with the arxiv.org host permission
// alone (the abstract pages' link needs it anyway), where webNavigation (or
// `tabs`) would add "Read your browsing history" to the install warning. A
// declarativeNetRequest redirect would skip Chrome's viewer altogether, but
// needs index.html in web_accessible_resources: any site could then detect the
// extension. Only tabs' own URLs are seen, never Xivly's downloads of the PDF.
const ARXIV = /^https?:\/\/(?:[\w-]+\.)*arxiv\.org\//;
const ARXIV_PDF = /^https?:\/\/(?:[\w-]+\.)*arxiv\.org\/pdf\/./;

chrome.tabs.onUpdated.addListener((tabId, { url }) => {
	if (url && ARXIV.test(url)) void openPdf(tabId, url.split('#')[0]);
});
chrome.tabs.onRemoved.addListener((tabId) => void chrome.storage.session.remove(`redirected:${tabId}`));

/**
 * The redirect leaves the PDF in the tab's history: going back to it shows it
 * in Chrome's viewer (no loop back to Xivly), until the tab shows another arXiv
 * page (other sites' URLs aren't seen).
 */
async function openPdf(tabId: number, url: string) {
	const key = `redirected:${tabId}`;
	const { [key]: from } = await chrome.storage.session.get(key);
	if (!ARXIV_PDF.test(url)) return void (from && (await chrome.storage.session.remove(key)));
	const { openArxivPdfs = true } = await chrome.storage.local.get('openArxivPdfs');
	if (url === from || !openArxivPdfs) return;
	await chrome.storage.session.set({ [key]: url });
	await chrome.tabs.update(tabId, { url: adding(url) });
}

/** Focus a library tab (the app answers from its library route), or open one. */
async function showLibrary() {
	if (!(await focusLibraryTab())) await chrome.tabs.create({ url: app() });
}
