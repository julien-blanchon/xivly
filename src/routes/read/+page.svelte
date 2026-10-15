<script lang="ts">
	import { iconButton } from '#lib/ui/button.js';
	import { page } from '$app/state';
	import { tick, untrack } from 'svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import {
		Annotations,
		Document,
		Find,
		Minimap,
		PageNav,
		Paper,
		Thumbnails,
		Toc,
		Viewer,
		Zoom,
		defaultCitationProvider,
		pageThemes,
		paperColors,
		sectionAt,
		shortcutGroups,
		type AnnotationTool,
		type Annotation,
		type AnnotationStore,
		type FindMatch,
		type PaperState,
		type Reference,
		type ViewerState,
		type KeymapAction,
		comboLabel
	} from 'svelte-pdf-mini';
	import { forgetCover } from '#lib/covers.js';
	import { exportPdfInWorker } from '#lib/export.js';
	import { metadataCache } from '#lib/metadata-cache.js';
	import { onFlush } from '#lib/flush.js';
	import { broadcast, onBroadcast } from '#lib/broadcast.js';
	import { fileManager, mac } from '#lib/os.js';
	import { button } from '#lib/ui/button.js';
	import { latexToUnicode } from '#lib/latex.js';
	import { library } from '#lib/library.svelte.js';
	import { platform } from '#lib/platform/index.js';
	import { ReaderLock } from '#lib/reader-lock.svelte.js';
	import { settings } from '#lib/settings.svelte.js';
	import { keys, matches } from '#lib/shortcuts.js';
	import { theme } from '#lib/theme.svelte.js';
	import { askUnsaved, closeWindow, openPaper, readerTab, saveFile, searchParams, setWindowTitle, showLibrary } from '#lib/windows.js';
	import PaperDetails from '#lib/components/PaperDetails.svelte';
	import { settingsDialog } from '#lib/components/SettingsDialog.svelte';
	import { shortcutsHelp } from '#lib/components/ShortcutsHelp.svelte';
	import { toast } from '#lib/components/Toasts.svelte';
	import { paperCache, warmPdf } from '#lib/pdf.js';
	import AnnotationToolbar from '#lib/pdf/AnnotationToolbar.svelte';
	import NoteHoverCard from '#lib/pdf/NoteHoverCard.svelte';
	import PdfContextMenu from '#lib/pdf/PdfContextMenu.svelte';
	import ThemePopover from '#lib/pdf/ThemePopover.svelte';
	import SaveStatus from '#lib/pdf/SaveStatus.svelte';
	import BackPill from '#lib/pdf/BackPill.svelte';
	import CenterControl from '#lib/pdf/CenterControl.svelte';
	import { icons } from '#lib/pdf/icons.js';
	import { emptyText, kindIcons, kindLabels } from '#lib/pdf/annotation-kinds.js';
	import AnnotationPreview, { hasPreview } from '#lib/pdf/AnnotationPreview.svelte';
	import { paperHex, paperInk } from 'svelte-pdf-mini';
	import Kbd from '#lib/ui/Kbd.svelte';
	import CycleButton, { type CycleOption } from '#lib/ui/CycleButton.svelte';
	import Separator from '#lib/ui/Separator.svelte';
	import Tabs from '#lib/ui/Tabs.svelte';
	import Tip from '#lib/ui/Tip.svelte';
	import ZoomSelect from '#lib/ui/ZoomSelect.svelte';
	import ZoomSlider from '#lib/ui/ZoomSlider.svelte';
	import { contextMenuState, isEditable, setFallbackMenu, type MenuItem } from '#lib/ui/context-menu.svelte.js';

	const id = $derived(searchParams(page.url).get('id') ?? '');
	const paper = $derived(library.get(id));
	/** The title as shown: LaTeX ("$\alpha$") as Unicode. */
	const title = $derived(paper ? latexToUnicode(paper.title) : '');
	const s = $derived(settings.values);

	// ── Look: pages tinted with the paper color (category or chosen) ─────
	const category = $derived(library.color(paper));
	// Pages take the category's matte color (Settings › Page look can turn it off).
	const paperColor = $derived(s.tintPages ? category.name : s.pageColor);
	const pageTheme = $derived(
		paperColor === 'white' && !theme.dark ? pageThemes.none() : pageThemes.paper({ color: paperHex(paperColor, theme.dark), dark: theme.dark, strength: s.paperStrength })
	);
	const swatch = $derived(pageTheme.background ?? '#ffffff');
	// The accent as text (section rail, links, focus outlines): an ink shade that reads on the page.
	const accent = $derived(paperInk(paperColors.find((c) => c.name === paperColor) ?? category, theme.dark));
	// Opening zoom only: later zooming is the reader's business.
	const initialZoom = untrack(() => settings.values.zoomMode);

	let bytes = $state.raw<Uint8Array | null>(null);
	// Handed over to pdf.js's worker, not copied: a large PDF isn't in memory twice
	// (the reader never reads these bytes again; saving asks pdf.js for them).
	const source = $derived(bytes && { data: bytes, transfer: true as const });
	/** The PDF: being read (a spinner after a moment), there, missing or unreadable. */
	let load = $state<{ status: 'loading' | 'ready' | 'missing' | 'error'; error?: string }>({ status: 'loading' });
	let slow = $state(false);
	let viewer = $state<ViewerState>();
	let store = $state<AnnotationStore>();
	let paperState = $state<PaperState>();
	let annotations = $state.raw<Annotation[]>([]);
	type Panel = 'contents' | 'pages' | 'figures' | 'references' | 'notes' | 'search' | 'info';
	let panel = $state<Panel>('contents');
	let panelOpen = $state(untrack(() => settings.values.sidePanel));
	let findInput = $state<HTMLInputElement | null>(null);
	let centerLocked = $state(false);

	// Annotation tools offered: highlight is the only text markup; one Box
	// tool, filled (area) or outlined (rect) per Settings › Annotations.
	const tools = $derived<AnnotationTool[]>(['select', 'hand', 'highlight', s.boxFill ? 'area' : 'rect', 'note', 'freetext', 'ink', 'arrow', 'eraser']);
	const keymap = $derived({ 'tool.area': s.boxFill ? ['b', 'a'] : [], 'tool.rect': s.boxFill ? [] : ['b', 'r'] });

	// `?` shows the reading & annotation keys of this paper too.
	$effect(() => {
		shortcutsHelp.pdf = () => (viewer ? shortcutGroups(viewer, store).map((g) => ({ title: g.title, items: g.items.map((i) => ({ label: i.label, keys: i.keys })) })) : []);
		return () => (shortcutsHelp.pdf = null);
	});

	const provider = $derived(s.citationLookup ? defaultCitationProvider({ semanticScholarKey: s.semanticScholarKey || undefined, cache: metadataCache }) : undefined);

	$effect(() => void (title && setWindowTitle(title)));

	// ── One reader per paper (reader-lock.svelte.ts) ─────────────────────
	// Another tab showing this paper would save over its annotations: only the
	// reader holding the paper's lock loads it; another one offers to take it over.
	let lock = $state<ReaderLock>();
	const access = $derived(lock?.access ?? 'checking');
	$effect(() => {
		const l = new ReaderLock(id);
		lock = l;
		void l.claim();
		return () => l.dispose();
	});
	// Web: the tab holding the paper is the one `openPaper` finds by name (and focuses).
	$effect(() => {
		if (platform.kind !== 'desktop') window.name = access === 'mine' ? readerTab(id) : '';
	});
	// Back to a tab that showed "open in another tab": the other one may be closed by now.
	function onvisibilitychange() {
		if (document.visibilityState === 'visible' && access === 'elsewhere') void lock?.claim();
	}

	function takeOver() {
		void lock?.takeOver(() => void broadcast('reader-take-over', { id }));
	}

	// Asked by another reader for this paper: save, then hand it over.
	$effect(() =>
		onBroadcast('reader-take-over', ({ id: wanted }) => {
			if (wanted !== id || access !== 'mine') return;
			void lock
				?.handOver(async () => {
					await save();
					return rev === savedRev;
				})
				.then((ok) => {
					if (ok) return;
					const error = saveError ?? 'unsaved annotations';
					void broadcast('reader-kept', { id, error });
					toast(`This paper stays open here: its annotations couldn’t be saved (${error})`, 'error');
				});
		})
	);
	$effect(() =>
		onBroadcast('reader-kept', ({ id: kept, error }) => {
			if (kept !== id || access !== 'waiting') return;
			lock?.cancel();
			toast(`The other ${platform.kind === 'desktop' ? 'window' : 'tab'} keeps this paper: its annotations couldn’t be saved (${error})`, 'error');
		})
	);

	// Load the PDF when the paper changes, or once this reader has it; the list refreshing must not reload it.
	$effect(() => {
		const current = id;
		const repo = library.repo;
		const mine = access === 'mine';
		untrack(() => {
			bytes = null;
			load = { status: 'loading' };
			slow = false;
			if (!mine) return;
			// Large PDFs (or iCloud downloading one) take a moment: a spinner then, not at once.
			const spinner = setTimeout(() => (slow = true), 300);
			warmPdf();
			repo
				?.readPdf(current)
				.then((b) => {
					if (current !== id) return;
					restoring = !!resumeAt();
					bytes = b;
					load = b ? { status: 'ready' } : { status: 'missing' };
				})
				.catch((e) => current === id && (load = { status: 'error', error: e instanceof Error ? e.message : String(e) }))
				.finally(() => clearTimeout(spinner));
			library.touch(current, { opened: new Date().toISOString() }).catch(() => {});
			// Hugging Face links (models, datasets, project page…), at most weekly.
			library.refreshHf(current).catch(() => {});
		});
	});

	// Settings that live on the annotation store.
	$effect(() => {
		if (!store) return;
		store.annotationsVisible = s.annotationsVisible;
		store.notesVisible = s.sideNotes;
	});

	// ── Saving annotations into the PDF ──────────────────────────────────
	// Edits only mark the paper dirty; it's written on ⌘S, by the autosave
	// timer, or when the window closes. Export runs in a worker.
	let rev = $state(0);
	let savedRev = $state(0);
	let saving = $state(false);
	/** Why the last save failed, until one succeeds (the save button shows it). */
	let saveError = $state<string | null>(null);
	// A PDF that needs a password to open can't be saved into: said once, before any annotating.
	$effect(() => {
		if (store?.saveSupport?.canSave !== false) return;
		untrack(() => toast('This PDF is password-protected: annotations can’t be saved into it (export them as Markdown instead).', 'info'));
	});
	/** The edits whose save failed: autosave doesn't retry them (⌘S or a new edit does). */
	let failedRev = -1;
	let chain: Promise<void> = Promise.resolve();
	const dirty = $derived(rev !== savedRev);

	function onAnnotationsChange(_: Annotation[], ops: unknown[]) {
		// `load` / import emit with no ops: nothing to save.
		if (ops.length) rev++;
	}

	/** `explicit`: asked for (⌘S, the save button), so a failure is shown again. */
	function save({ explicit = false } = {}): Promise<void> {
		const target = { id, store, viewer, repo: library.repo };
		chain = chain.then(async () => {
			const r = rev;
			if (r === savedRev || !target.store || !target.viewer || !target.repo) return;
			saving = true;
			try {
				const data = await target.viewer.document.getData();
				const out = await exportPdfInWorker(data, $state.snapshot(target.store.annotations) as Annotation[], { producer: 'Xivly', remove: [...target.store.removedForeign] });
				await target.repo.savePdf(target.id, out);
				forgetCover(target.id);
				savedRev = Math.max(savedRev, r);
				saveError = null;
			} catch (e) {
				// From the export worker, an error may arrive as text ("Error: …").
				const error = (e instanceof Error ? e.message : String(e)).replace(/^Error: /, '');
				failedRev = r;
				// Once per problem: an autosave failing again every 30 s says nothing new.
				if (explicit || error !== saveError) toast(`Couldn’t save the annotations: ${error}`, 'error');
				saveError = error;
			} finally {
				saving = false;
			}
		});
		return chain;
	}

	// Autosave on an interval (Settings › Saving).
	$effect(() => {
		const seconds = s.autosaveSeconds;
		if (!seconds) return;
		const timer = setInterval(() => rev !== savedRev && rev !== failedRev && save(), seconds * 1000);
		return () => clearInterval(timer);
	});

	// Window close / quit: save, discard or cancel.
	$effect(() =>
		onFlush({
			dirty: () => rev !== savedRev,
			flush: async () => {
				const name = title || 'this paper';
				let choice = settings.values.confirmUnsaved ? await askUnsaved(name) : 'save';
				for (;;) {
					if (choice === 'cancel') return false;
					if (choice === 'discard') {
						savedRev = rev;
						return true;
					}
					await save();
					if (rev === savedRev) return true;
					// The save failed (folder offline, paper removed, a PDF that can't be
					// written…): always ask, so the window can still close without saving.
					choice = await askUnsaved(name, saveError ?? undefined);
				}
			}
		})
	);

	// Removed from the library (another window, Finder…): nothing to save any more, and the
	// window closes (or says why, on the web where a script can't close every tab).
	$effect(() =>
		onBroadcast('paper-removed', ({ id: removed }) => {
			if (removed !== id) return;
			savedRev = rev;
			void library.reloadPaper(id).then(() => closeWindow());
		})
	);

	// Remember the reading position (no hook, debounced).
	let posTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		void viewer?.readingPoint;
		const target = id;
		clearTimeout(posTimer);
		posTimer = setTimeout(() => {
			if (!restoring && viewer?.document.status === 'ready' && library.get(target)) library.touch(target, { position: Number(viewer.position.toFixed(2)) }).catch(() => {});
		}, 1500);
		return () => clearTimeout(posTimer);
	});

	// Reopen where you left off: the pages stay hidden until they're there (no jump from page 1).
	const resumeAt = () => (s.resumePosition && paper?.position && paper.position >= 1.01 ? paper.position : undefined);
	let restoring = $state(false);
	async function restorePosition() {
		const position = resumeAt();
		// Shown anyway if the restore hangs (a page that never loads).
		const reveal = setTimeout(() => (restoring = false), 2000);
		try {
			if (position) {
				await new Promise(requestAnimationFrame);
				await viewer?.restorePosition(position);
			}
		} catch {
			// Opens at the top instead.
		} finally {
			clearTimeout(reveal);
			restoring = false;
		}
	}

	// ── Panels, find, menus ──────────────────────────────────────────────
	/** Where ⌘F came from: Esc in the search field goes back there (or closes the panel). */
	let beforeFind: Panel | null | undefined;

	async function openPanel(p: Panel) {
		if (p === 'search' && !(panelOpen && panel === 'search')) beforeFind = panelOpen ? panel : null;
		panel = p;
		panelOpen = true;
		if (p === 'search') {
			await new Promise((r) => setTimeout(r, 30));
			findInput?.focus();
			findInput?.select();
		}
	}

	/** A view's shortcut: open the panel on it, or close the panel if it's already showing it. */
	function togglePanel(p: Panel) {
		if (panelOpen && panel === p) panelOpen = false;
		else openPanel(p);
	}

	/** Esc in the search field: back to the paper, and to the panel as it was before ⌘F. */
	function onFindKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		if (beforeFind === null) panelOpen = false;
		else if (beforeFind) panel = beforeFind;
		beforeFind = undefined;
		viewer?.scrollEl?.focus({ preventScroll: true });
	}

	const panelKeys: [string, Panel][] = [
		[keys.panelContents, 'contents'],
		[keys.panelPages, 'pages'],
		[keys.panelFigures, 'figures'],
		[keys.panelReferences, 'references'],
		[keys.panelNotes, 'notes'],
		[keys.panelInfo, 'info']
	];

	/** Find matches grouped by the section they fall in (find example). */
	function groups(found: FindMatch[]) {
		const out: { key: string; title: string; matches: FindMatch[] }[] = [];
		for (const m of found) {
			const sec = paperState?.sections.length && m.rect ? sectionAt(paperState.sections, m.page, m.rect[3]) : null;
			const key = sec?.id ?? `p${m.page}`;
			const title = sec ? [sec.number, sec.title].filter(Boolean).join(' ') : `Page ${m.page}`;
			const last = out.at(-1);
			if (last?.key === key) last.matches.push(m);
			else out.push({ key, title, matches: [m] });
		}
		return out;
	}

	/** A cited paper: into the library (arXiv) and open, else search it. */
	async function openReference(r: Reference) {
		const arxiv = r.parsed.arxivId;
		if (!arxiv) return platform.openUrl(`https://scholar.google.com/scholar?q=${encodeURIComponent(r.parsed.title ?? r.raw)}`);
		try {
			if (!library.papers.some((p) => p.arxiv === arxiv)) toast('Adding to your library…');
			const { id: pid } = await library.importArxiv(arxiv);
			openPaper(pid, r.parsed.title ?? pid);
		} catch (e) {
			toast(String(e), 'error');
		}
	}

	async function exportAnnotatedPdf() {
		if (!store || !viewer) return;
		try {
			const out = await exportPdfInWorker(await viewer.document.getData(), $state.snapshot(store.annotations) as Annotation[], { producer: 'Xivly', remove: [...store.removedForeign] });
			await saveFile(new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), `${id}.pdf`);
		} catch (e) {
			toast(`Export failed: ${e}`, 'error');
		}
	}

	async function exportNotes() {
		if (!store) return;
		const md = store.toMarkdown({ title: paper?.title, sections: paperState?.flatSections.map((x) => ({ title: x.title, page: x.page, y: x.y })) });
		await saveFile(new Blob([md], { type: 'text/markdown' }), `${id}-notes.md`).catch((e) => toast(`Export failed: ${e}`, 'error'));
	}

	const exportItems = (): MenuItem[] => [
		{ label: 'PDF with annotations…', icon: icons.download, onSelect: exportAnnotatedPdf },
		{ label: 'Notes as Markdown…', icon: 'icon-[lucide--file-text]', onSelect: exportNotes }
	];

	const viewItems = (): MenuItem[] => [
		{ label: 'Minimap', icon: icons.map, shortcut: keys.minimap, checked: s.minimap, onSelect: () => settings.set('minimap', !s.minimap) },
		{ label: 'Section rail', icon: 'icon-[lucide--git-commit-vertical]', checked: s.tocRail, onSelect: () => settings.set('tocRail', !s.tocRail) },
		{ label: 'Reading progress', icon: 'icon-[lucide--minus]', checked: s.progressBar, onSelect: () => settings.set('progressBar', !s.progressBar) },
		{ label: 'Annotations', icon: icons.eye, shortcut: keys.annotations, checked: s.annotationsVisible, separatorBefore: true, onSelect: () => settings.set('annotationsVisible', !s.annotationsVisible) },
		{ label: 'Side notes', icon: icons.notes, shortcut: keys.sideNotes, checked: s.sideNotes, onSelect: () => settings.set('sideNotes', !s.sideNotes) },
		{ label: 'Line markers', icon: 'icon-[lucide--align-left]', shortcut: keys.lineMarkers, checked: s.lineMarkers, onSelect: () => settings.set('lineMarkers', !s.lineMarkers) },
		{ label: 'Link previews', icon: 'icon-[lucide--scan-eye]', checked: s.linkPreviews, separatorBefore: true, onSelect: () => settings.set('linkPreviews', !s.linkPreviews) },
		{ label: 'Citation cards', icon: 'icon-[lucide--quote]', checked: s.citationCards, onSelect: () => settings.set('citationCards', !s.citationCards) }
	];

	// Pages per row: one cycle (the cover page alone is a kind of spread).
	type RowMode = 'single' | 'spread' | 'cover' | 'auto';
	const rowModes: CycleOption<RowMode>[] = [
		{ value: 'single', label: 'Single page', icon: 'icon-[lucide--file]' },
		{ value: 'spread', label: 'Spread', icon: 'icon-[lucide--columns-2]' },
		{ value: 'cover', label: 'Spread, cover page alone', icon: 'icon-[lucide--book-open]' },
		{ value: 'auto', label: 'Auto (zoom out for more)', icon: 'icon-[lucide--layout-grid]' }
	];
	const rowMode = $derived<RowMode>(s.columns === 1 ? 'single' : s.columns === 'auto' ? 'auto' : s.firstPageAlone ? 'cover' : 'spread');
	function setRowMode(mode: RowMode) {
		settings.set('columns', mode === 'single' ? 1 : mode === 'auto' ? 'auto' : 2);
		if (mode === 'spread' || mode === 'cover') settings.set('firstPageAlone', mode === 'cover');
	}
	const scrollModes: CycleOption<typeof s.scrollMode>[] = [
		{ value: 'vertical', label: 'Continuous', icon: 'icon-[lucide--move-vertical]' },
		{ value: 'page', label: 'Paged', icon: 'icon-[lucide--gallery-vertical]' },
		{ value: 'horizontal', label: 'Horizontal', icon: 'icon-[lucide--move-horizontal]' }
	];

	const layoutItems = (): MenuItem[] => [
		...rowModes.map((m, i) => ({ heading: i ? undefined : 'Pages per row', label: m.label, shortcut: m.value === 'spread' ? keys.spread : undefined, checked: rowMode === m.value, onSelect: () => setRowMode(m.value) })),
		...scrollModes.map((m, i) => ({ heading: i ? undefined : 'Scrolling', separatorBefore: !i, label: m.label, shortcut: [keys.scrollContinuous, keys.scrollPaged, keys.scrollHorizontal][i], checked: s.scrollMode === m.value, onSelect: () => settings.set('scrollMode', m.value) }))
	];

	// Right-click on the chrome (header, panel): app actions for this paper.
	$effect(() =>
		setFallbackMenu(() => [
			{ label: 'Save annotations', icon: 'icon-[lucide--save]', shortcut: keys.save, disabled: !dirty, onSelect: () => save({ explicit: true }) },
			{ label: 'Find in paper', icon: icons.search, shortcut: keys.find, onSelect: () => openPanel('search') },
			{ label: 'View', icon: icons.eye, separatorBefore: true, items: viewItems() },
			{ label: 'Layout', icon: icons.columns, items: layoutItems() },
			{ label: 'Export', icon: 'icon-[lucide--share]', items: exportItems() },
			{ label: 'Keyboard shortcuts', icon: 'icon-[lucide--keyboard]', shortcut: keys.help, separatorBefore: true, onSelect: () => (shortcutsHelp.open = true) },
			{ label: 'Settings…', icon: 'icon-[lucide--settings]', shortcut: keys.settings, onSelect: () => (settingsDialog.open = true) }
		])
	);

	function onkeydown(e: KeyboardEvent) {
		if (matches(e, keys.save)) (e.preventDefault(), void save({ explicit: true }));
		else if (matches(e, keys.find)) (e.preventDefault(), openPanel('search'));
		else if (matches(e, keys.panel) || matches(e, keys.panelAlt)) (e.preventDefault(), (panelOpen = !panelOpen));
		else if (matches(e, keys.closeWindow)) (e.preventDefault(), closeWindow());
		else if (panelKeys.some(([k]) => matches(e, k))) (e.preventDefault(), togglePanel(panelKeys.find(([k]) => matches(e, k))![1]));
		else if (matches(e, keys.scrollContinuous)) (e.preventDefault(), settings.set('scrollMode', 'vertical'));
		else if (matches(e, keys.scrollPaged)) (e.preventDefault(), settings.set('scrollMode', 'page'));
		else if (matches(e, keys.scrollHorizontal)) (e.preventDefault(), settings.set('scrollMode', 'horizontal'));
		else if (matches(e, keys.spread)) (e.preventDefault(), settings.set('columns', s.columns === 2 ? 1 : 2));
		else if (matches(e, keys.minimap)) (e.preventDefault(), settings.set('minimap', !s.minimap));
		else if (matches(e, keys.annotations)) (e.preventDefault(), settings.set('annotationsVisible', !s.annotationsVisible));
		else if (matches(e, keys.sideNotes)) (e.preventDefault(), settings.set('sideNotes', !s.sideNotes));
		else if (matches(e, keys.lineMarkers)) (e.preventDefault(), settings.set('lineMarkers', !s.lineMarkers));
	}

	// V while Select is already on switches its mode (with / without the color menu). Capture
	// phase: runs before the viewer's own V, which would make Select current either way.
	function onSelectKey(e: KeyboardEvent) {
		// ⌘S while typing a note: the field keeps its keys, and commits its text when it loses focus.
		if (matches(e, keys.save) && isEditable(e.target)) {
			e.preventDefault();
			e.stopPropagation();
			e.target.blur();
			return void tick().then(() => save({ explicit: true }));
		}
		if (!store || store.tool !== 'select' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
		if ((store.keymap['tool.select'] ?? []).includes(e.key.toLowerCase())) settings.set('selectionMenu', !s.selectionMenu);
	}

	/** A viewer shortcut's label ("←", "⌘+"), from the active keymap. */
	const viewKey = (action: KeymapAction) => (viewer ? comboLabel(viewer.keymap, action) : undefined);

	const showMenu = (items: () => MenuItem[]) => (e: MouseEvent) => contextMenuState.showAt(e.currentTarget as HTMLElement, items());

	const iconBtn = iconButton(7);
	// Opaque (no backdrop blur): blurring over a scrolling PDF costs every frame in WebKit.
	const chrome = 'bg-stone-50 dark:bg-stone-900';
	const kindIcon: Record<string, string> = { citation: 'icon-[lucide--quote]', figure: 'icon-[lucide--image]', table: 'icon-[lucide--table]', section: 'icon-[lucide--heading]', equation: 'icon-[lucide--sigma]', footnote: 'icon-[lucide--asterisk]', url: icons.external };
	const chipBtn = 'inline-flex items-center gap-1 rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800';
	const toggleOpt = 'rounded px-1.5 py-0.5 font-mono text-[11px] text-muted data-[active]:bg-stone-800 data-[active]:text-white dark:data-[active]:bg-stone-200 dark:data-[active]:text-stone-900';
</script>

<svelte:window {onkeydown} onkeydowncapture={onSelectKey} />
<svelte:document {onvisibilitychange} />

{#snippet cornerButtons()}
	<Tip label={panelOpen ? 'Hide side panel' : 'Show side panel'} shortcut={keys.panelAlt}>
		{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="Side panel" data-active={panelOpen || undefined} onclick={() => (panelOpen = !panelOpen)}><span class="{icons.panel} size-4"></span></button>{/snippet}
	</Tip>
	<Tip label="Library" shortcut={keys.library}>
		{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="Show the library" onclick={showLibrary}><span class="icon-[lucide--library] size-4"></span></button>{/snippet}
	</Tip>
{/snippet}

{#if !paper}
	<div class="grid h-full place-items-center text-sm text-muted" data-tauri-drag-region>
		<div class="text-center">
			<p>This paper is no longer in your library.</p>
			<button class="mt-2 underline" onclick={closeWindow}>Close</button>
		</div>
	</div>
{:else if bytes}
	<Document.Root src={source} onLoad={restorePosition}>
		<Viewer.Root
			bind:viewer
			{pageTheme}
			pageFrame={s.pageFrame}
			theme={theme.dark ? 'dark' : 'light'}
			zoomMode={initialZoom}
			minZoom={0.5}
			maxZoom={3}
			overscan={2}
			zoomLocked={centerLocked}
			bind:columns={() => s.columns, (v) => settings.set('columns', v === 'auto' ? 'auto' : v === 2 ? 2 : 1)}
			bind:scrollMode={() => s.scrollMode, (v) => settings.set('scrollMode', v)}
			firstPageAlone={s.firstPageAlone}
			smoothZoom={s.smoothZoom}
			wheelZoom={s.wheelZoom}
			keyboard="document"
			{keymap}
			class="flex h-full flex-col"
			style="--pdf-accent:{accent}"
		>
			<Find.Root>
				{#snippet children({ find })}
					<Paper.Root {provider} cache={paperCache} bind:paper={paperState}>
						<Annotations.Root
							bind:annotations
							bind:store
							importFromPdf
							{tools}
							author={{ name: s.author || 'Me' }}
							stickyTools={s.stickyTools}
							selectOn={s.selectOn}
							editOnCreate={s.editOnCreate}
							inkSmoothing={s.inkSmoothing}
							foreign={s.foreignAnnotations}
							noteEmojis={s.noteEmojis}
							freetextFont={s.freetextFont}
							{onAnnotationsChange}
						>
							<!--
								Full-height sidebar (macOS): when open, the traffic lights sit on it.
								One animated value drives it all: --side-w (the panel's width). The
								panel toggle and library button never move, and the title row keeps clear
								of the lights and buttons at every frame (its padding is computed from --side-w).
							-->
							<div class="reader-row relative flex min-h-0 flex-1" data-panel={panelOpen || undefined}>
								<div class="absolute top-2 left-2 z-40 flex gap-1 lights:left-20">{@render cornerButtons()}</div>
								<!-- ── Side panel ── -->
								<aside class="side flex shrink-0 flex-col overflow-hidden text-[13px] {chrome}" inert={!panelOpen}>
									<div class="flex min-h-0 w-80 flex-1 flex-col">
											<!-- Under the toggle (and the traffic lights on macOS). -->
											<div class="h-11 shrink-0" data-tauri-drag-region></div>
											<Tabs
												bind:value={panel}
												tabs={[
													{ value: 'contents', label: '', tip: 'Contents', shortcut: keys.panelContents, icon: icons.list },
													{ value: 'pages', label: '', tip: 'Pages', shortcut: keys.panelPages, icon: icons.layers },
													{ value: 'figures', label: '', tip: 'Figures, tables & equations', shortcut: keys.panelFigures, icon: 'icon-[lucide--image]' },
													{ value: 'references', label: '', tip: 'References', shortcut: keys.panelReferences, icon: 'icon-[lucide--quote]' },
													{ value: 'notes', label: '', tip: 'Notes', shortcut: keys.panelNotes, badge: annotations.length || undefined, icon: icons.notes },
													{ value: 'search', label: '', tip: 'Find', shortcut: keys.find, icon: icons.search },
													{ value: 'info', label: '', tip: 'Paper info', shortcut: keys.panelInfo, icon: 'icon-[lucide--info]' }
												]}
												class="min-h-0 flex-1"
												listClass="m-2"
											>
												{#snippet content(tab)}
													<div class="min-h-0 flex-1 overflow-y-auto px-2 {tab === 'info' ? '' : 'pb-3'}">
														{#if tab === 'contents'}
															<p class="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">Contents</p>
															<Toc.Tree class="[--pdf-toc-indent:14px]">
																{#snippet empty({ status })}<p class="p-2 text-muted">{status === 'analyzing' ? 'Reading the paper…' : 'No sections found.'}</p>{/snippet}
															</Toc.Tree>
														{:else if tab === 'pages'}
															<Thumbnails.Root width={136} class="space-y-2 pt-1">
																{#each { length: viewer?.document.numPages ?? 0 } as _, i (i)}
																	<Thumbnails.Item pageNumber={i + 1} class="mx-auto flex flex-col items-center gap-1 rounded-md p-1.5 text-xs text-muted data-[current]:bg-stone-200 dark:data-[current]:bg-stone-800 [&_[data-pdf-thumbnail-canvas]]:rounded [&_[data-pdf-thumbnail-canvas]]:shadow" />
																{/each}
															</Thumbnails.Root>
														{:else if tab === 'figures'}
															<Paper.Figures kinds={['figure', 'table', 'algorithm', 'equation']} thumbnailWidth={290} class="space-y-3 pt-1 [&_[data-part=caption]]:line-clamp-2 [&_[data-part=caption]]:text-xs [&_[data-part=caption]]:text-muted [&_[data-part=label]]:mt-1 [&_[data-part=label]]:block [&_[data-part=label]]:font-medium [&_[data-part=open]]:block [&_[data-part=open]]:w-full [&_[data-part=open]]:rounded-md [&_[data-part=open]]:p-1.5 [&_[data-part=open]]:text-left [&_[data-part=open]:hover]:bg-stone-200/70 dark:[&_[data-part=open]:hover]:bg-stone-800 [&_[data-part=thumbnail]]:min-h-12 [&_[data-part=thumbnail]]:overflow-hidden [&_[data-part=thumbnail]]:rounded [&_[data-part=thumbnail]]:bg-white" />
														{:else if tab === 'references'}
															<Paper.References class="space-y-0.5 pt-1">
																{#snippet item({ reference, citedCount, go, nextCitation })}
																	<div class="group rounded-md px-2 py-1.5 hover:bg-stone-200/70 dark:hover:bg-stone-800">
																		<button class="block w-full text-left" onclick={go}>
																			<span class="mr-1 font-mono text-[11px] text-muted">{reference.label}</span>
																			<span class="font-medium">{reference.parsed.title ?? reference.raw.slice(0, 120)}</span>
																			<span class="block text-xs text-muted">{reference.parsed.authors.slice(0, 3).join(', ')}{reference.parsed.year ? ` · ${reference.parsed.year}` : ''}</span>
																		</button>
																		<div class="mt-0.5 flex items-center gap-2 text-xs">
																			{#if citedCount}<button class="inline-flex items-center gap-1 text-stone-600 hover:underline dark:text-stone-300" onclick={nextCitation}>cited {citedCount}× <span class="{icons.down} size-3"></span></button>{/if}
																			{#if reference.parsed.arxivId}<button class="text-muted opacity-0 group-hover:opacity-100 hover:underline focus-visible:opacity-100" onclick={() => openReference(reference)}>Add to library</button>{/if}
																		</div>
																	</div>
																{/snippet}
															</Paper.References>
														{:else if tab === 'notes'}
															<Annotations.List class="space-y-2 pt-1">
																{#snippet item({ annotation, quote, pageLabel, go, color, emoji })}
																	{@const preview = hasPreview(annotation)}
																	<button class="block w-full rounded-md border-l-4 bg-white/80 px-2.5 py-2 text-left shadow-sm hover:shadow dark:bg-stone-800/80" style:border-color={color} onclick={go}>
																		<span class="flex items-center gap-1.5 text-[11px] text-muted">
																			{#if emoji}<span class="w-3.5 shrink-0 text-center font-emoji text-[13px] leading-none">{emoji}</span>{:else}<span class="{kindIcons[annotation.kind]} size-3.5 shrink-0"></span>{/if}{kindLabels[annotation.kind]}
																			<span class="ml-auto tabular-nums">p. {pageLabel}</span>
																		</span>
																		{#if annotation.label}<span class="block font-medium">{annotation.label}</span>{/if}
																		{#if quote}<span class="line-clamp-3 block font-serif text-[13px] text-stone-600 dark:text-stone-300">{quote}</span>{/if}
																		{#if preview}<span class="mt-1.5 block"><AnnotationPreview {annotation} {color} /></span>{/if}
																		{#if annotation.contents}<span class="mt-1 block border-t border-stone-200 pt-1 dark:border-stone-700"><Annotations.Markdown source={annotation.contents} /></span>{/if}
																		{#if !annotation.label && !quote && !preview && !annotation.contents}<span class="block text-muted italic">{emptyText[annotation.kind] ?? 'No text'}</span>{/if}
																	</button>
																{/snippet}
																{#snippet empty()}
																	<p class="flex flex-wrap items-center gap-1 p-2 text-muted">Select text, then press <Kbd>H</Kbd> to highlight (or <Kbd>1</Kbd>–<Kbd>9</Kbd> for a color).</p>
																{/snippet}
															</Annotations.List>
														{:else if tab === 'search'}
															<div class="space-y-2 pt-1 pb-2">
																<div class="flex items-center gap-1 rounded-md border border-edge bg-white px-2 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400 dark:bg-stone-900">
																	<span class="{icons.search} size-3.5 text-stone-400"></span>
																	<Find.Input bind:ref={findInput} captureShortcut={false} onkeydown={onFindKey} class="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted" placeholder="Find in paper" />
																	<Find.Count class="text-[11px] whitespace-nowrap text-muted tabular-nums" />
																	<Tip label="Previous match" shortcut={mac ? '⇧↵' : 'Shift+Enter'}>{#snippet child({ props })}<Find.Prev {...props} class="grid size-6 place-items-center disabled:opacity-30"><span class="{icons.up} size-4"></span></Find.Prev>{/snippet}</Tip>
																	<Tip label="Next match" shortcut="↵">{#snippet child({ props })}<Find.Next {...props} class="grid size-6 place-items-center disabled:opacity-30"><span class="{icons.down} size-4"></span></Find.Next>{/snippet}</Tip>
																</div>
																<div class="flex items-center gap-1">
																	<Find.Toggle option="caseSensitive" class={toggleOpt} />
																	<Find.Toggle option="wholeWord" class={toggleOpt} />
																	<Find.Toggle option="diacritics" class={toggleOpt} />
																	<Find.Toggle option="regex" class={toggleOpt} />
																	{#if find.status === 'searching'}<span class="ml-auto text-[11px] text-muted">page {find.searchedPages}/{viewer?.document.numPages}</span>{/if}
																</div>
															</div>
															{#each groups(find.matches) as g (g.key)}
																<p class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{g.title} <span class="font-normal">· {g.matches.length}</span></p>
																{#each g.matches as match (match.index)}
																	<Find.Result {match} class="block w-full rounded-md px-2 py-1.5 text-left hover:bg-stone-200/70 data-[active]:bg-amber-100 dark:hover:bg-stone-800 dark:data-[active]:bg-amber-900/40 [&_[data-part=page]]:mr-2 [&_[data-part=page]]:text-xs [&_[data-part=page]]:text-muted [&_mark]:rounded-sm [&_mark]:bg-amber-300/70 [&_mark]:px-0.5" />
																{/each}
															{/each}
														{:else}
															<div class="flex min-h-full flex-col px-2 pt-2">
																<PaperDetails {paper}>
																	{#snippet actions({ btn })}
																		<Tip label="Export the PDF with annotations">{#snippet child({ props })}<button {...props} class={btn} aria-label="Export PDF" onclick={exportAnnotatedPdf}><span class="{icons.download} size-4"></span></button>{/snippet}</Tip>
																		<Tip label="Export notes as Markdown">{#snippet child({ props })}<button {...props} class={btn} aria-label="Export notes" onclick={exportNotes}><span class="icon-[lucide--file-text] size-4"></span></button>{/snippet}</Tip>
																	{/snippet}
																</PaperDetails>
															</div>
														{/if}
													</div>
												{/snippet}
											</Tabs>
										</div>
									</aside>

								<div class="flex min-w-0 flex-1 flex-col">
									<!-- ── Header ─────────────────────────────────────── -->
									<header class="relative z-30 border-b border-stone-200/80 {chrome} dark:border-stone-800" data-tauri-drag-region>
										<div class="title-row flex h-11 items-center gap-1 pr-2" data-tauri-drag-region>
											<div class="mx-2 flex min-w-0 flex-1 items-baseline gap-3" data-tauri-drag-region>
												<!-- The title gets at most half the room; the section breadcrumb the rest. -->
												<p class="min-w-0 truncate font-serif text-[15px] {s.breadcrumb ? 'xl:max-w-1/2' : ''}" {title} data-tauri-drag-region>{title}</p>
												{#if s.breadcrumb}<Toc.Breadcrumb class="flex min-w-0 flex-1 truncate text-xs text-muted [&_[data-pdf-toc-item]]:truncate" />{/if}
											</div>

											<Tip label={paper.read ? 'Read: mark as unread' : 'Mark as read'}>
												{#snippet child({ props })}
													<button
														{...props}
														class={iconBtn}
														style:color={paper.read ? accent : undefined}
														aria-pressed={!!paper.read}
														aria-label={paper.read ? 'Read' : 'Mark as read'}
														onclick={() => library.toggleRead(paper)}
													>
														<span class="{paper.read ? 'icon-[lucide--book-check]' : 'icon-[lucide--book]'} size-4"></span>
													</button>
												{/snippet}
											</Tip>
											<SaveStatus {dirty} {saving} error={dirty ? saveError : null} onsave={() => save({ explicit: true })} />
											<Tip label="Find in paper" shortcut={keys.find}>
												{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="Find" data-active={(panelOpen && panel === 'search') || undefined} onclick={() => (panelOpen && panel === 'search' ? (panelOpen = false) : openPanel('search'))}><span class="{icons.search} size-4"></span></button>{/snippet}
											</Tip>
											<Tip label="View">
												{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="View options" onclick={showMenu(viewItems)}><span class="{icons.eye} size-4"></span></button>{/snippet}
											</Tip>
											<ThemePopover {swatch} />
											<Tip label="Keyboard shortcuts" shortcut={keys.help}>
												{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="Keyboard shortcuts" onclick={() => (shortcutsHelp.open = true)}><span class="icon-[lucide--keyboard] size-4"></span></button>{/snippet}
											</Tip>
											<Tip label="Settings" shortcut={keys.settings}>
												{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="Settings" onclick={() => (settingsDialog.open = true)}><span class="icon-[lucide--settings] size-4"></span></button>{/snippet}
											</Tip>
										</div>

										<!-- Toolbar: annotation tools (always there), pages, zoom, layout. -->
										<div class="@container flex h-10 items-center gap-1 px-2">
											<AnnotationToolbar {tools} class="min-w-0 overflow-x-auto [scrollbar-width:none]" />
											<div class="min-w-2 flex-1"></div>
											<Tip label="Previous page" shortcut={viewKey('nav.prevPage')}>{#snippet child({ props })}<PageNav.Prev {...props} class={iconBtn}><span class="{icons.up} size-4"></span></PageNav.Prev>{/snippet}</Tip>
											<PageNav.Input class="h-6 w-10 shrink-0 rounded-md bg-black/5 text-center text-xs tabular-nums dark:bg-white/10" />
											<span class="hidden shrink-0 px-1 text-xs text-muted tabular-nums @2xl:inline">/ {viewer?.document.numPages ?? '–'}</span>
											<Tip label="Next page" shortcut={viewKey('nav.nextPage')}>{#snippet child({ props })}<PageNav.Next {...props} class={iconBtn}><span class="{icons.down} size-4"></span></PageNav.Next>{/snippet}</Tip>
											<Separator />
											<Tip label="Zoom out" shortcut={viewKey('view.zoomOut')}>{#snippet child({ props })}<Zoom.Out {...props} class={iconBtn}><span class="{icons.zoomOut} size-4"></span></Zoom.Out>{/snippet}</Tip>
											{#if viewer}<ZoomSlider {viewer} class="hidden w-28 shrink-0 @5xl:flex" /><ZoomSelect {viewer} class="hidden h-7 w-28 shrink-0 border-transparent bg-black/5 text-xs @3xl:inline-flex dark:bg-white/10" />{/if}
											<Tip label="Zoom in" shortcut={viewKey('view.zoomIn')}>{#snippet child({ props })}<Zoom.In {...props} class={iconBtn}><span class="{icons.zoomIn} size-4"></span></Zoom.In>{/snippet}</Tip>
											<Separator />
											<CycleButton title="Pages per row" options={rowModes} value={rowMode} onchange={setRowMode} />
											<CycleButton title="Scrolling" options={scrollModes} value={s.scrollMode} onchange={(v) => settings.set('scrollMode', v)} />
										</div>
										{#if s.progressBar}<Toc.Progress class="absolute! inset-x-0 bottom-0 rounded-none! bg-transparent! [--pdf-progress-height:2px]" />{/if}
									</header>

									<div class="flex min-h-0 flex-1">
										<!-- ── Pages ──────────────────────────────────────── -->
										<div class="relative min-w-0 flex-1">
											<PdfContextMenu onOpenReference={openReference} {saveFile}>
												{#snippet trigger({ props })}
													<Viewer.Viewport {...props} style={s.pageFrame === 'none' ? `background:${swatch}` : undefined} class="h-full bg-stone-100 transition-colors dark:bg-stone-950 [--pdf-page-gap:22px] [--pdf-pages-padding:28px] {s.sideNotes ? '[--pdf-pages-aside:252px]' : ''}">
														<Viewer.Pages class={restoring ? 'opacity-0' : 'transition-opacity duration-150'}>
															{#snippet children({ pageNumber })}
																<Viewer.Page {pageNumber}>
																	<Viewer.Canvas />
																	<Viewer.TextLayer />
																	<Viewer.LinkLayer class="[&_a]:rounded-sm [&_a:hover]:bg-sky-500/10" />
																	<Find.Layer />
																	<Paper.Layer />
																	<Annotations.Layer />
																	{#if s.lineMarkers}<Annotations.LineMarkers markers="all" />{/if}
																	{#if s.sideNotes}<Annotations.Margin edge={s.tocRail ? 36 : 8} class="[--pdf-margin-width:220px]" />{/if}
																	<Viewer.Focus />
																</Viewer.Page>
															{/snippet}
														</Viewer.Pages>
													</Viewer.Viewport>
												{/snippet}
											</PdfContextMenu>
											{#if s.tocRail}<Toc.Rail class="absolute top-8 right-3 bottom-8 text-muted" />{/if}
											<BackPill />
											<CenterControl bind:locked={centerLocked} />
											{#if paperState?.status === 'analyzing'}
												<div class="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/70 px-3 py-1 text-xs text-white" transition:fade>Reading the paper… {Math.round(paperState.progress * 100)}%</div>
											{/if}
										</div>

										{#if s.minimap}
											<div transition:slide={{ axis: 'x', duration: 160 }} class="flex shrink-0">
												<Minimap.Root style="background:{swatch}" variant={s.minimapVariant} width={s.minimapVariant === 'heatmap' ? 18 : s.minimapVariant === 'spine' ? 120 : 84} class="h-full border-l border-stone-200 dark:border-stone-800">
													{#if s.minimapVariant === 'heatmap'}<Minimap.Heatmap />{/if}
													<Minimap.Viewport class="rounded-sm! bg-sky-500/10! shadow-[inset_0_0_0_var(--hairline)_rgb(14_165_233/0.5)]!" />
													{#if s.minimapVariant !== 'heatmap'}<Minimap.Markers find annotations sections={s.minimapVariant !== 'spine'} />{/if}
												</Minimap.Root>
											</div>
										{/if}
									</div>
								</div>
							</div>

							<!-- ── Floating UI ──────────────────────────────────── -->
							{#if s.citationCards}
								<Paper.CitationCard>
									{#snippet actions({ reference })}
										{#if reference.parsed.arxivId}
											<button type="button" class={chipBtn} onclick={() => openReference(reference)}><span class="{icons.import} size-3"></span>Add to library</button>
											<button type="button" class={chipBtn} onclick={() => platform.openUrl(`https://arxiv.org/abs/${reference.parsed.arxivId}`)}><span class="{icons.external} size-3"></span>arXiv</button>
										{:else}
											<button type="button" class={chipBtn} onclick={() => openReference(reference)}><span class="{icons.search} size-3"></span>Scholar</button>
										{/if}
									{/snippet}
								</Paper.CitationCard>
							{/if}
							{#if s.linkPreviews}
								<Paper.CrossRefPreview forceMount>
									{#snippet child({ props, open, label, canvasProps })}
										{#if open}
											<div {...props} transition:scale|global={{ start: 0.96, duration: 130 }} class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900">
												<div {...(canvasProps as Record<string, never>)}></div>
												<p class="border-t border-stone-100 px-3 py-1.5 text-xs text-muted dark:border-stone-800">{label}</p>
											</div>
										{/if}
									{/snippet}
								</Paper.CrossRefPreview>
								<Viewer.LinkPreview forceMount placement="top" width={440} kinds={['section', 'equation', 'footnote', 'page', 'other', 'url']}>
									{#snippet child({ props, open, kind, page: target, url, canvasProps })}
										{#if open}
											<div {...props} transition:fly|global={{ y: 6, duration: 140 }} class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-stone-700 dark:bg-stone-900">
												{#if url}
													<button type="button" class="flex w-full cursor-pointer items-center gap-2 p-3 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800" onclick={() => url && platform.openUrl(url)}>
														<span class="{icons.external} size-4 shrink-0 text-stone-400"></span><span class="truncate text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">{url}</span>
													</button>
												{:else}
													<div {...(canvasProps as Record<string, never>)}></div>
													<p class="flex items-center gap-1.5 border-t border-stone-100 bg-stone-50 px-3 py-1.5 text-xs text-muted capitalize dark:border-stone-800 dark:bg-stone-950">
														<span class="{kindIcon[kind] ?? 'icon-[lucide--link]'} size-3.5"></span>{kind} · page {target}
													</p>
												{/if}
											</div>
										{/if}
									{/snippet}
								</Viewer.LinkPreview>
							{/if}
							<Paper.Backlinks />
							{#if s.selectionMenu}<Annotations.SelectionMenu />{/if}
							<Annotations.Popover />
							<NoteHoverCard />
						</Annotations.Root>
					</Paper.Root>
				{/snippet}
			</Find.Root>
		</Viewer.Root>
	</Document.Root>
{:else if access === 'elsewhere' || access === 'waiting'}
	{@const where = platform.kind === 'desktop' ? 'window' : 'tab'}
	<div class="grid h-full place-items-center bg-stone-100 px-6 text-center text-sm text-muted dark:bg-stone-950" data-tauri-drag-region>
		<div>
			<p class="text-stone-700 dark:text-stone-300">This paper is open in another {where}.</p>
			<p class="mx-auto mt-1 max-w-sm text-xs">It’s read and annotated in one place at a time, so that one {where} never saves over the other’s annotations.</p>
			<div class="mt-4 flex justify-center gap-2">
				<button class={button('secondary')} onclick={closeWindow}>Close</button>
				<button class={button('primary')} disabled={access === 'waiting'} onclick={takeOver}>{access === 'waiting' ? 'Saving it there…' : 'Read it here'}</button>
			</div>
		</div>
	</div>
{:else if load.status === 'missing' || load.status === 'error'}
	<div class="grid h-full place-items-center bg-stone-100 px-6 text-center text-sm text-muted dark:bg-stone-950" data-tauri-drag-region>
		<div>
			<p class="text-stone-700 dark:text-stone-300">{load.status === 'missing' ? 'This paper’s PDF is missing from its folder.' : 'The PDF couldn’t be opened.'}</p>
			{#if load.error}<p class="mt-1 max-w-md text-xs">{load.error}</p>{/if}
			<div class="mt-4 flex justify-center gap-2">
				{#if platform.reveal}<button class={button('secondary')} onclick={() => platform.reveal?.(`papers/${id}/paper.json`)}>Show in {fileManager}</button>{/if}
				<button class={button('primary')} onclick={closeWindow}>Close</button>
			</div>
		</div>
	</div>
{:else}
	<div class="grid h-full place-items-center bg-stone-100 dark:bg-stone-950" data-tauri-drag-region>
		{#if slow}<span class="icon-[lucide--loader-circle] size-5 animate-spin text-stone-400" aria-label="Opening the PDF"></span>{/if}
	</div>
{/if}

<style>
	@property --side-w {
		syntax: '<length>';
		inherits: true;
		initial-value: 0px;
	}
	.reader-row {
		--side-w: 0px;
		/* Room the title row keeps free on the left: traffic lights (macOS desktop), panel toggle and library button. */
		--chrome-w: 68px;
		transition: --side-w 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	:global([data-lights]) .reader-row {
		--chrome-w: 140px;
	}
	.reader-row[data-panel] {
		--side-w: 320px;
	}
	.side {
		width: var(--side-w);
		box-shadow: inset -1px 0 0 var(--color-stone-200);
		/* Hidden (not just 0-wide) once closed, so it costs nothing. */
		visibility: hidden;
		transition: visibility 0s 200ms;
	}
	:global(.dark) .side {
		box-shadow: inset -1px 0 0 var(--color-stone-800);
	}
	[data-panel] .side {
		visibility: visible;
		transition: none;
	}
	.title-row {
		padding-left: max(0.5rem, calc(var(--chrome-w) - var(--side-w)));
	}
	@media (prefers-reduced-motion: reduce) {
		.reader-row {
			transition: none;
		}
	}
</style>
