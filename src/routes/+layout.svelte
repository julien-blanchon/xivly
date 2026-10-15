<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import '#lib/pdf.js';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { Tooltip } from 'bits-ui';
	import { onMount, type Snippet } from 'svelte';
	import { addFiles } from '#lib/add-paper.js';
	import { flushAll, hasUnsaved } from '#lib/flush.js';
	import { library } from '#lib/library.svelte.js';
	import { openUrlParam } from '#lib/open-url.svelte.js';
	import { platform } from '#lib/platform/index.js';
	import { settings } from '#lib/settings.svelte.js';
	import { keys, matches } from '#lib/shortcuts.js';
	import { mac, os } from '#lib/os.js';
	import { theme } from '#lib/theme.svelte.js';
	import { fixRestoredSize, searchParams, showLibrary } from '#lib/windows.js';
	import SettingsDialog, { settingsDialog } from '#lib/components/SettingsDialog.svelte';
	import Welcome from '#lib/components/Welcome.svelte';
	import Toasts, { toast } from '#lib/components/Toasts.svelte';
	import GlobalContextMenu from '#lib/ui/GlobalContextMenu.svelte';
	import TitleTooltips from '#lib/ui/TitleTooltips.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import StarterDialog from '#lib/components/StarterDialog.svelte';
	import PromptHost from '#lib/ui/PromptHost.svelte';
	import DetailsDialog from '#lib/components/DetailsDialog.svelte';
	import { isEditable, onWindowContextMenu } from '#lib/ui/context-menu.svelte.js';
	import ShortcutsHelp, { shortcutsHelp } from '#lib/components/ShortcutsHelp.svelte';

	let { children }: { children: Snippet } = $props();

	// pdf.js 6 ships for current engines only (no polyfills): bail out clearly
	// instead of half-rendering on an old browser.
	// Every one of these is used by pdf.js 6 (a partly supported engine, e.g. an
	// older WebKitGTK, would otherwise break in the worker).
	const modern =
		typeof (Math as { sumPrecise?: unknown }).sumPrecise === 'function' &&
		typeof (Map.prototype as { getOrInsertComputed?: unknown }).getOrInsertComputed === 'function' &&
		typeof (Uint8Array as { fromBase64?: unknown }).fromBase64 === 'function' &&
		typeof (Promise as { try?: unknown }).try === 'function' &&
		typeof (globalThis as { Float16Array?: unknown }).Float16Array === 'function';
	let dragDepth = $state(0);

	// Before the first render: layout and wording depend on the OS (see `lights:` in app.css).
	document.documentElement.dataset.os = os;
	document.documentElement.toggleAttribute('data-lights', platform.kind === 'desktop' && mac);

	$effect(() => {
		document.documentElement.classList.toggle('dark', theme.dark);
	});

	onMount(() => {
		if (!modern) {
			// Nothing to save here, but ⌘Q waits for every window's answer.
			if (platform.kind !== 'desktop') return;
			const unlisten = [
				listen('quit-requested', () => invoke('quit_response', { ok: true })),
				listen('library-change-requested', () => invoke('library_change_response', { ok: true }))
			];
			return () => unlisten.forEach((p) => p.then((f) => f()));
		}
		settings.init().then(() => library.init());
		if (__XIVLY_EXTENSION__) void import('#lib/extension/app.svelte.js').then((m) => m.startExtension());
		// `/?add=<link>`: add that paper and read it (the extension adds its own steps).
		else openUrlParam();
		if (platform.kind !== 'desktop') return;
		void fixRestoredSize();
		const win = getCurrentWindow();
		const unlisten = [
			listen<{ hook: string; success: boolean; output: string }>('hook-finished', ({ payload: r }) => {
				const mode = settings.values.hookToasts;
				if (mode === 'all' || (mode === 'errors' && !r.success))
					toast(r.success ? `Hook ${r.hook} ran` : `Hook ${r.hook} failed: ${r.output.slice(-200)}`, r.success ? 'info' : 'error');
			}),
			// Closing this window: unsaved work is saved, discarded or the close cancelled.
			win.onCloseRequested(async (e) => {
				await settings.flush();
				if (!hasUnsaved()) return;
				e.preventDefault();
				if (await flushAll()) await win.destroy();
			}),
			// ⌘Q: every window answers (Rust quits once all agree), whatever happens:
			// an exception must not leave the quit waiting for this window forever.
			listen('quit-requested', async () => {
				let ok = false;
				try {
					await settings.flush();
					ok = !hasUnsaved() || (await flushAll());
				} catch (e) {
					console.error(e);
				} finally {
					await invoke('quit_response', { ok });
				}
			}),
			// Settings › Library › Change… (from any window): every window saves its
			// work (or the user cancels the change) before the library changes.
			listen('library-change-requested', async () => {
				let ok = false;
				try {
					await settings.flush();
					ok = !hasUnsaved() || (await flushAll());
				} catch (e) {
					console.error(e);
				} finally {
					// Until every window answered (or one hangs): no new edit that the change would lose.
					document.body.inert = ok;
					if (ok) setTimeout(() => (document.body.inert = false), 15_000);
					await invoke('library_change_response', { ok });
				}
			}),
			// Changed: the library window opens the new library, readers (of the old one) close.
			// Closing still asks about work left unsaved, which can't go into the new library.
			listen<boolean>('library-change-finished', async ({ payload: changed }) => {
				document.body.inert = false;
				if (!changed) return;
				if (win.label === 'main') return library.init();
				await showLibrary();
				await win.close();
			})
		];
		return () => unlisten.forEach((p) => p.then((f) => f()));
	});

	// Web: the browser asks before leaving with unsaved annotations.
	function onbeforeunload(e: BeforeUnloadEvent) {
		void settings.flush();
		if (hasUnsaved()) e.preventDefault();
	}

	function onkeydown(e: KeyboardEvent) {
		// Desktop on Windows/Linux: the webview's browser keys (reload, print) would throw away unsaved work.
		if (platform.kind === 'desktop' && !mac && (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && /^[rp]$/i.test(e.key)))) return e.preventDefault();
		if (platform.kind === 'desktop' && !mac && matches(e, keys.quit)) {
			e.preventDefault();
			void invoke('request_quit');
		} else if (matches(e, keys.settings)) {
			e.preventDefault();
			settingsDialog.open = !settingsDialog.open;
		} else if (matches(e, keys.toggleTheme)) {
			e.preventDefault();
			theme.toggle();
		} else if (matches(e, keys.library)) {
			e.preventDefault();
			showLibrary();
		} else if (e.key === '?' && !isEditable(e.target)) {
			e.preventDefault();
			shortcutsHelp.open = !shortcutsHelp.open;
		}
	}

	// Pick up changes made outside the app (Finder, iCloud, agents, hooks, other windows).
	// A reader window only refreshes its own paper.
	function onfocus() {
		if (library.status !== 'ready') return;
		const id = page.route.id === '/read' ? searchParams(page.url).get('id') : null;
		void (id ? library.reloadPaper(id) : library.reload());
	}

	// HTML5 drag & drop: same code path in Tauri (dragDropEnabled: false) and browsers.
	const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
	function ondrop(e: DragEvent) {
		e.preventDefault();
		dragDepth = 0;
		if (library.status === 'ready' && e.dataTransfer) void addFiles([...e.dataTransfer.files]);
	}
</script>

<svelte:window
	{onfocus}
	{onbeforeunload}
	{onkeydown}
	oncontextmenu={onWindowContextMenu}
	ondragenter={(e) => hasFiles(e) && dragDepth++}
	ondragleave={(e) => hasFiles(e) && (dragDepth = Math.max(0, dragDepth - 1))}
	ondragover={(e) => e.preventDefault()}
	{ondrop}
/>

<Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
	<div class="h-full bg-stone-50 text-stone-800 dark:bg-stone-950 dark:text-stone-200">
		{#if page.route.id?.startsWith('/dev')}
			<!-- Dev tools (e.g. /dev/starter) don't need a library. The extension
			     build skips dev/+layout.ts (vite.config.js), which 404s them. -->
			{#if !__XIVLY_EXTENSION__}{@render children()}{/if}
		{:else if !modern}
			<div class="grid h-full place-items-center px-6 text-center" data-tauri-drag-region>
				<div>
					<h1><Wordmark class="text-4xl" /></h1>
					<p class="mt-4 text-sm text-stone-600 dark:text-stone-400">Xivly needs an up-to-date browser (Chrome, Edge, Arc or Safari 26).</p>
				</div>
			</div>
		{:else if library.status === 'loading' || !settings.ready}
			<div class="h-full" data-tauri-drag-region></div>
		{:else if library.status !== 'ready'}
			<Welcome />
		{:else}
			{@render children()}
		{/if}

		{#if dragDepth > 0 && library.status === 'ready'}
			<div class="pointer-events-none fixed inset-3 z-(--z-overlay) grid place-items-center rounded-2xl border-2 border-dashed border-stone-400 bg-stone-100/70 backdrop-blur-sm dark:bg-stone-900/70">
				<p class="text-lg text-stone-600 dark:text-stone-300">Drop PDFs to add them</p>
			</div>
		{/if}
		<Toasts />
		<GlobalContextMenu />
		<ShortcutsHelp />
		<TitleTooltips />
		<PromptHost />
		{#if library.status === 'ready'}<DetailsDialog />{/if}
		{#if settings.ready}<SettingsDialog /><StarterDialog />{/if}
	</div>
</Tooltip.Provider>
