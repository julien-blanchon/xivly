/// <reference types="chrome" />
// Chrome extension, page side: the app is the web build in an extension page,
// plus what the service worker (./background.ts) asks of it. Loaded by
// +layout.svelte in extension builds only.
import { page } from '$app/state';
import { openUrlParam } from '#lib/open-url.svelte.js';
import { settings } from '#lib/settings.svelte.js';
import { prompts } from '#lib/ui/prompt.svelte.js';
import { readerTab } from '#lib/windows.js';
import type { ExtensionMessage } from './messages';

export function startExtension() {
	if (__XIVLY_EXTENSION_DEV__) liveReload();
	// The toolbar button focuses a tab showing the library; "Open in Xivly" the paper's reader.
	chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, respond) => {
		const found =
			message.type === 'find-library'
				? page.route.id === '/'
				: // The reader holding the paper's lock names its tab after it (windows.ts).
					message.type === 'find-reader' && page.route.id === '/read' && window.name === readerTab(message.id);
		if (!found) return false;
		void chrome.tabs.getCurrent().then(respond);
		return true;
	});
	// "Open in Xivly" opens `#/?add=<url>` (../open-url.svelte.ts).
	openUrlParam({ download, shownElsewhere: focusReader });
	// The service worker can't read the settings (localStorage): "Open arXiv PDFs in Xivly" for it.
	$effect.root(() => {
		$effect(() => {
			if (settings.ready) void chrome.storage.local.set({ openArxivPdfs: settings.values.openArxivPdfs });
		});
	});
}

/**
 * `bun run dev:extension` rebuilds into build-extension/ and writes
 * dev-build.json last: a new page build reloads this tab, a new service worker
 * or manifest reloads the whole extension (Chrome reads unpacked files live).
 */
function liveReload() {
	let last: { page: string; worker: string } | undefined;
	setInterval(async () => {
		const build = await fetch('/dev-build.json', { cache: 'no-store' })
			.then((r) => r.json())
			.catch(() => undefined);
		if (!build) return;
		if (last && build.worker !== last.worker) {
			// The reload closes this tab: the new service worker reopens it.
			const { reopen = [] } = await chrome.storage.local.get('reopen');
			await chrome.storage.local.set({ reopen: [...(reopen as string[]), location.href] });
			chrome.runtime.reload();
		} else if (last && build.page !== last.page) location.reload();
		last = build;
	}, 1000);
}

/**
 * Already open in a reader: show that tab. This one closes if it was opened for
 * the paper; one that came from a page (an arXiv PDF opened here) keeps the library.
 */
async function focusReader(id: string) {
	const reader = await chrome.runtime.sendMessage<ExtensionMessage, chrome.tabs.Tab | undefined>({ type: 'find-reader', id }).catch(() => undefined);
	if (reader?.id === undefined) return false;
	await chrome.tabs.update(reader.id, { active: true });
	await chrome.windows.update(reader.windowId, { focused: true });
	const self = await chrome.tabs.getCurrent();
	if (self?.id !== undefined && history.length === 1) await chrome.tabs.remove(self.id);
	return true;
}

/**
 * Sites that don't allow cross-origin downloads (CORS) need their host
 * permission, optional in the manifest: asked for the first time, in a click.
 */
async function download(url: string): Promise<Response | null> {
	const { origin, host } = new URL(url);
	const origins = [`${origin}/*`];
	try {
		return await fetch(url);
	} catch (e) {
		if (!(e instanceof TypeError) || (await chrome.permissions.contains({ origins }))) throw e;
	}
	const allow = await prompts.confirm(`Download papers from ${host}?`, {
		message: `${host} doesn’t let other sites download its PDFs. Chrome will ask you to let Xivly read ${host}: it only downloads the PDFs you open in Xivly.`,
		confirmLabel: 'Continue'
	});
	// Still in the click on "Continue" (Chrome asks only in a user gesture).
	if (!allow || !(await chrome.permissions.request({ origins }))) return null;
	return fetch(url);
}
