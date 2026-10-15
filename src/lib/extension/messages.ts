/// <reference types="chrome" />
// Shared by the extension's service worker and its pages.

/** Where "Open in Xivly" shows up: arXiv (and its mirrors parseArxiv knows) and PDF links. */
export const PAPER_URLS = [
	'*://*.arxiv.org/abs/*',
	'*://*.arxiv.org/pdf/*',
	'*://*.arxiv.org/html/*',
	'*://*.alphaxiv.org/abs/*',
	'*://*.alphaxiv.org/overview/*',
	'*://huggingface.co/papers/*',
	'*://*/*.pdf',
	'*://*/*.pdf?*',
	'*://*/*.pdf#*'
];

/**
 * Between the extension's pages and its service worker: "is a library tab
 * open?", "is this paper open in a reader?" (answered with that tab). From the
 * "Open in Xivly" link on arXiv abstract pages (./content.ts) to the service
 * worker: open the page it is on (in a background tab: a middle or ⌘/Ctrl click).
 */
export type ExtensionMessage = { type: 'find-library' } | { type: 'find-reader'; id: string } | { type: 'open-page'; background: boolean };

/** Switch to a tab showing the library (one answers `find-library`): false when none is open. */
export async function focusLibraryTab() {
	const found = await chrome.runtime.sendMessage<ExtensionMessage, chrome.tabs.Tab | undefined>({ type: 'find-library' }).catch(() => undefined);
	if (found?.id === undefined) return false;
	await chrome.tabs.update(found.id, { active: true });
	await chrome.windows.update(found.windowId, { focused: true });
	return true;
}
