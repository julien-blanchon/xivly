// Windows (desktop) and tabs (web): the library stays open, each paper gets
// its own reader window.
import { resolve } from '$app/paths';
import type { ReadonlyURL } from '$app/state';
import { toast } from './components/Toasts.svelte';
import { latexToUnicode } from './latex';
import { platform } from './platform';
import { readerOpen } from './reader-lock.svelte';

const readerPath = (id: string) => `${resolve('/read')}?id=${encodeURIComponent(id)}`;

/**
 * Web: the name of the tab reading a paper. The reader holding the paper's lock
 * takes it (reader-lock.svelte.ts), so opening the paper again finds that tab.
 */
export const readerTab = (id: string) => `xivly-${id}`;

/** A page's query (`?id=…`): after the `#` in the Chrome extension (hash router, vite.config.js). */
export const searchParams = (url: ReadonlyURL) => (__XIVLY_EXTENSION__ ? new URLSearchParams(url.hash.split('?')[1]) : url.searchParams);
/** Window labels allow `a-zA-Z0-9-/:_`; paper ids are slugs. */
const labelFor = (id: string) => `paper-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

/**
 * Open a paper that is still being added (downloaded, imported). Call it in
 * the user's gesture: on the web the tab must be opened right away (later
 * window.open calls are blocked as pop-ups), then pointed at the paper.
 */
export function openPaperWhenReady() {
	const web = platform.kind !== 'desktop';
	// Without a live gesture (a drop, a second file) the browser would block the tab.
	const tab = web && navigator.userActivation.isActive ? window.open('', '_blank') : null;
	return {
		async open(id: string, title?: string) {
			if (!tab) return void openPaper(id, title);
			// Already open (an arXiv paper added again): show that tab instead.
			const other = (await readerOpen(id)) && findTab(id);
			if (other) {
				tab.close();
				return other.focus();
			}
			// Named now: opening the paper again (double-click) finds this tab.
			tab.name = readerTab(id);
			tab.location.href = readerPath(id);
			tab.focus();
		},
		cancel: () => tab?.close()
	};
}

/**
 * The tab named after the paper (only while the paper's lock is held, so it is
 * there), without reloading it; null if this window can't reach it (a tab the
 * extension opened).
 */
function findTab(id: string) {
	const tab = window.open('', readerTab(id));
	if (tab && !isBlank(tab)) return tab;
	tab?.close();
	return null;
}

/** A tab just opened (nothing loaded yet), vs. one showing a page. */
function isBlank(tab: Window) {
	try {
		return tab.location.href === 'about:blank';
	} catch {
		// Another site's page.
		return false;
	}
}

/** Open a paper in its own window / tab, or focus it if already open. */
export async function openPaper(id: string, title = 'Xivly') {
	title = latexToUnicode(title);
	if (platform.kind !== 'desktop') {
		// A named target reuses the paper's tab when it's already open. Pop-ups need
		// a live gesture: after an await, offer an "Open" button (a click) instead.
		if (!navigator.userActivation.isActive) return toast(`Added “${title}”`, 'info', { label: 'Open', run: () => void openPaper(id, title) });
		// An empty URL finds the paper's tab without reloading it (its annotations
		// may be unsaved); only a new tab is pointed at the paper.
		const tab = window.open('', readerTab(id));
		if (tab && isBlank(tab)) tab.location.href = readerPath(id);
		tab?.focus();
		return;
	}
	const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
	const { LogicalPosition } = await import('@tauri-apps/api/dpi');
	const label = labelFor(id);
	const existing = await WebviewWindow.getByLabel(label);
	if (existing) {
		await existing.unminimize();
		await existing.setFocus();
		return;
	}
	new WebviewWindow(label, {
		url: readerPath(id),
		title,
		width: 1180,
		height: 900,
		minWidth: 640,
		minHeight: 480,
		titleBarStyle: 'overlay',
		hiddenTitle: true,
		// Centered on the reader's 44pt top row (22pt): the buttons' center lands at y - 3pt (measured).
		trafficLightPosition: new LogicalPosition(16, 25),
		dragDropEnabled: false
	});
}

/** Name of the browser tab showing the library (web). */
export const LIBRARY_TAB = 'xivly-library';

/** Bring the library back (desktop: re-create its window if it was closed). */
export async function showLibrary() {
	if (__XIVLY_EXTENSION__) {
		const { focusLibraryTab } = await import('./extension/messages');
		if (await focusLibraryTab()) return;
	}
	if (platform.kind !== 'desktop') {
		// The library's tab carries this name (routes/+page.svelte): tabs opened from it
		// switch back to it; otherwise a new tab shows the library.
		const tab = window.open('', LIBRARY_TAB);
		if (tab?.location.href === 'about:blank') tab.location.href = resolve('/');
		tab?.focus();
		return;
	}
	const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
	const { LogicalPosition } = await import('@tauri-apps/api/dpi');
	const main = await WebviewWindow.getByLabel('main');
	if (main) return main.setFocus();
	new WebviewWindow('main', {
		url: resolve('/'),
		title: 'Xivly',
		width: 1280,
		height: 840,
		minWidth: 720,
		minHeight: 480,
		titleBarStyle: 'overlay',
		hiddenTitle: true,
		// Centered on the library's 48pt top row (24pt), see above.
		trafficLightPosition: new LogicalPosition(16, 27),
		dragDropEnabled: false
	});
}

/** Close this window (desktop) or tab (web; only works for tabs we opened). */
export async function closeWindow() {
	if (platform.kind !== 'desktop') return window.close();
	const { getCurrentWindow } = await import('@tauri-apps/api/window');
	await getCurrentWindow().close();
}

export async function setWindowTitle(title: string) {
	document.title = title;
	if (platform.kind !== 'desktop') return;
	const { getCurrentWindow } = await import('@tauri-apps/api/window');
	await getCurrentWindow().setTitle(title);
}

/**
 * Native Save / Don't Save / Cancel (desktop: the web asks through beforeunload);
 * `error`: why the last save failed.
 */
export async function askUnsaved(title: string, error?: string): Promise<'save' | 'discard' | 'cancel'> {
	const { message } = await import('@tauri-apps/plugin-dialog');
	const text = error ? `Your annotations in “${title}” couldn’t be saved: ${error}` : `Your annotations in “${title}” haven’t been saved yet.`;
	const r = await message(text, {
		title: 'Save changes?',
		kind: 'warning',
		buttons: { yes: 'Save', no: 'Don’t Save', cancel: 'Cancel' }
	});
	return r === 'Yes' || r === 'Save' ? 'save' : r === 'No' || r === 'Don’t Save' ? 'discard' : 'cancel';
}

/** Save a file the user names (desktop: native dialog; web: download). */
export async function saveFile(file: Blob, name: string) {
	if (platform.kind !== 'desktop') {
		const url = URL.createObjectURL(file);
		Object.assign(document.createElement('a'), { href: url, download: name }).click();
		setTimeout(() => URL.revokeObjectURL(url), 5000);
		return;
	}
	const { save } = await import('@tauri-apps/plugin-dialog');
	const { writeFile } = await import('@tauri-apps/plugin-fs');
	const ext = name.split('.').pop() ?? '';
	const path = await save({ defaultPath: name, filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [] });
	// The dialog grants fs access to exactly the chosen path.
	if (path) await writeFile(path, new Uint8Array(await file.arrayBuffer()));
}

/**
 * A window restored (by tauri-plugin-window-state) smaller than it may be,
 * e.g. a size saved from a window that had no minimum, gets its default size
 * back, centered.
 */
export async function fixRestoredSize() {
	if (platform.kind !== 'desktop') return;
	const { getCurrentWindow } = await import('@tauri-apps/api/window');
	const { LogicalSize } = await import('@tauri-apps/api/dpi');
	const win = getCurrentWindow();
	const library = win.label === 'main';
	const [min, def] = library ? [[720, 480], [1280, 840]] : [[640, 480], [1180, 900]];
	const size = (await win.innerSize()).toLogical(await win.scaleFactor());
	if (size.width >= min[0] && size.height >= min[1]) return;
	await win.setSize(new LogicalSize(def[0], def[1]));
	await win.center();
}
