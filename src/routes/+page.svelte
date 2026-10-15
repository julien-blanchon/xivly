<script lang="ts">
	import { iconButton, mutedIcon } from '#lib/ui/button.js';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import { library } from '#lib/library.svelte.js';
	import { coverStyles, settings } from '#lib/settings.svelte.js';
	import { keys, matches } from '#lib/shortcuts.js';
	import PaperCard from '#lib/components/PaperCard.svelte';
	import { warmCovers } from '#lib/covers.js';
	import { settingsDialog } from '#lib/components/SettingsDialog.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import Kbd from '#lib/ui/Kbd.svelte';
	import Tip from '#lib/ui/Tip.svelte';
	import { setFallbackMenu, type MenuItem } from '#lib/ui/context-menu.svelte.js';
	import { LIBRARY_TAB, setWindowTitle } from '#lib/windows.js';
	import { readOptions, sortMenu, sortOptions } from '#lib/sort-menu.js';
	import { onLibraryPaste, pickFiles } from '#lib/add-paper.js';
	import AddPapers, { addPapers } from '#lib/components/AddPapers.svelte';
	import CategoryDialog, { showCategoryDialog } from '#lib/components/CategoryDialog.svelte';
	import CycleButton, { type CycleOption } from '#lib/ui/CycleButton.svelte';
	import type { RecentWindow, SortKey } from '#lib/settings.svelte.js';
	import { starter } from '#lib/onboarding/starter.svelte.js';
	import ToggleGroup from '#lib/ui/ToggleGroup.svelte';
	import VirtualGrid from '#lib/ui/VirtualGrid.svelte';
	import { disjointViewKey } from '#lib/ui/view-key.js';
	import { button } from '#lib/ui/button.js';
	import { ARCHIVED } from '#lib/library.svelte.js';
	import { prefersReducedMotion } from 'svelte/motion';
	import { verbatim } from '#lib/ui/verbatim.js';

	let search = $state<HTMLInputElement>();
	let scroller = $state<HTMLElement>();
	let searchFocused = $state(false);

	const title = $derived.by(() => {
		const v = library.view;
		if (v.kind === 'category') return library.category(v.id)?.name ?? '';
		return { all: 'All papers', recent: 'Recent', uncategorized: 'Uncategorized' }[v.kind];
	});
	$effect(() => void setWindowTitle(library.name ? `Xivly — ${library.name}` : 'Xivly'));
	// Web: a reader opened from this tab switches back to it (showLibrary).
	$effect(() => {
		window.name = LIBRARY_TAB;
		return () => (window.name = '');
	});

	// The grid is rebuilt (a fade) only when the view changes to papers that share none with
	// the previous ones (e.g. one category to another): otherwise shared cards move (flip).
	const viewKey = disjointViewKey();
	const gridKey = $derived(viewKey.next(JSON.stringify(library.view), library.filtered.map((p) => p.id)));

	// Motion: none with reduced motion; long lists don't animate at all (flip measures every
	// card on each change); while typing a search, cards re-flow without easing.
	let typing = $state(false);
	let typingTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearchInput() {
		typing = true;
		clearTimeout(typingTimer);
		typingTimer = setTimeout(() => (typing = false), 400);
	}
	const animated = $derived(library.filtered.length <= 150 && !prefersReducedMotion.current);
	const motion = $derived(animated && !typing ? 1 : 0);
	const minCard = $derived({ small: 140, medium: 170, large: 220 }[settings.values.cardSize]);

	// "First page" covers: the ones not cached yet render ahead of time, once the
	// covers on screen are done (one at a time, only while nothing else renders).
	$effect(() => {
		if (settings.values.coverStyle !== 'page' || library.status !== 'ready') return;
		const ids = library.papers.map((p) => p.id);
		const timer = setTimeout(() => void warmCovers(ids), 2000);
		return () => clearTimeout(timer);
	});

	const newCategory = () => showCategoryDialog();

	// Right-click on empty space.
	const backgroundMenu = (): MenuItem[] => [
		{ label: 'Add papers…', icon: 'icon-[lucide--plus]', shortcut: keys.addArxiv, onSelect: () => (addPapers.open = true) },
		{ label: 'New category…', icon: 'icon-[lucide--folder-plus]', onSelect: newCategory },
		{ label: 'Sort', icon: 'icon-[lucide--arrow-down-wide-narrow]', separatorBefore: true, items: sortMenu() },
		{ label: 'Show', icon: 'icon-[lucide--eye]', items: readOptions.map((o) => ({ label: o.label, checked: settings.values.readFilter === o.value, onSelect: () => settings.set('readFilter', o.value) })) },
		{
			label: 'Card size',
			icon: 'icon-[lucide--layout-grid]',
			items: (['small', 'medium', 'large'] as const).map((v) => ({ label: v[0].toUpperCase() + v.slice(1), checked: settings.values.cardSize === v, onSelect: () => settings.set('cardSize', v) }))
		},
		{ label: 'Cover style', icon: 'icon-[lucide--book]', items: coverStyles.map((c) => ({ label: c.label, checked: settings.values.coverStyle === c.value, onSelect: () => settings.set('coverStyle', c.value) })) },
		{ label: 'Settings…', icon: 'icon-[lucide--settings]', shortcut: keys.settings, separatorBefore: true, onSelect: () => (settingsDialog.open = true) }
	];
	$effect(() => setFallbackMenu(backgroundMenu));

	function onkeydown(e: KeyboardEvent) {
		if (matches(e, keys.search)) {
			e.preventDefault();
			search?.focus();
			search?.select();
		} else if (matches(e, keys.addPapers)) {
			e.preventDefault();
			void pickFiles();
		} else if (matches(e, keys.addArxiv)) {
			e.preventDefault();
			addPapers.open = true;
		} else if (e.key === 'Escape' && e.target === search) {
			library.query = '';
			search?.blur();
		}
	}

	const sortByOptions: CycleOption<SortKey>[] = sortOptions.map((o) => ({ value: o.value, label: o.label, icon: o.icon }));

	/** What hides papers right now (besides the view), for the empty state. */
	const activeFilters = $derived.by(() => {
		const out: string[] = [];
		if (library.query.trim()) out.push(`matching “${library.query.trim()}”`);
		const rf = settings.values.readFilter;
		if (rf !== 'all') out.push(rf === 'unread' ? 'unread only' : 'read only');
		for (const [t, mode] of Object.entries(library.tagFilter)) {
			if (t === ARCHIVED && mode === 'out') continue; // the default: mentioned only when it hides something
			out.push(mode === 'in' ? `only #${t}` : `hiding #${t}`);
		}
		return out;
	});
	/** Papers of this view before any filter (archived included). */
	const inView = $derived(
		library.papers.filter((p) => {
			const v = library.view;
			if (v.kind === 'category') return p.category === v.id;
			if (v.kind === 'uncategorized') return !library.category(p.category);
			return true;
		})
	);
	const archivedHidden = $derived(library.tagFilter[ARCHIVED] === 'out' && inView.some((p) => p.tags?.includes(ARCHIVED)));
	const filtering = $derived(activeFilters.length > 0 || archivedHidden);
	const emptyMessage = $derived.by(() => {
		if (!library.papers.length) return 'Your library is empty.';
		if (!inView.length) return `Nothing in ${title} yet.`;
		if (library.view.kind === 'recent' && !activeFilters.length) {
			const label = recentOptions.find((o) => o.value === settings.values.recentWindow)?.label.toLowerCase();
			return `Nothing opened in the ${label}.`;
		}
		const why = [...activeFilters, ...(archivedHidden ? ['archived papers are hidden'] : [])];
		return why.length ? `No papers here: ${why.join(', ')}.` : 'No papers match.';
	});
	function clearFilters() {
		library.query = '';
		settings.set('readFilter', 'all');
		for (const t of Object.keys(library.tagFilter)) library.setTagFilter(t, null);
	}
	const recentOptions: CycleOption<RecentWindow>[] = [
		{ value: 'day', label: 'Last day', icon: 'icon-[lucide--clock]' },
		{ value: 'week', label: 'Last 7 days', icon: 'icon-[lucide--calendar-days]' },
		{ value: 'month', label: 'Last 30 days', icon: 'icon-[lucide--calendar-range]' }
	];
	/** Every order label, whatever the sort: the order button keeps room for the longest. */
	const orderLabels = sortOptions.flatMap((o) => [o.desc, o.asc]);
	const orderOptions = $derived.by((): CycleOption<boolean>[] => {
		const o = sortOptions.find((x) => x.value === settings.values.sortBy) ?? sortOptions[0];
		return [
			{ value: true, label: o.desc, icon: 'icon-[lucide--arrow-down-wide-narrow]' },
			{ value: false, label: o.asc, icon: 'icon-[lucide--arrow-up-narrow-wide]' }
		];
	});
	const iconBtn = iconButton(8);
</script>

<svelte:window {onkeydown} onpaste={onLibraryPaste} />

<CategoryDialog />

<div class="flex h-full">
	<Sidebar onNewCategory={newCategory} />

	<main class="flex min-w-0 flex-1 flex-col">
		<!-- A container: at narrow widths labels and the read filter fold away (720px windows). -->
		<header class="@container flex h-12 shrink-0 items-center gap-3 px-6 max-lg:gap-2" data-tauri-drag-region>
			<h1 class="min-w-0 shrink-[0.05] truncate font-serif text-xl" data-tauri-drag-region>{title}</h1>
			<span class="text-sm text-muted tabular-nums" data-tauri-drag-region>{library.filtered.length}</span>
			<div class="flex-1" data-tauri-drag-region></div>
			{#if starter.running}
				<span class="flex shrink-0 items-center gap-1.5 text-xs text-muted" transition:fade><span class="icon-[lucide--loader-circle] size-3.5 animate-spin"></span><span class="@max-4xl:hidden">Adding example papers</span> {starter.done}/{starter.total || '…'}</span>
			{:else if library.importing}
				<span class="flex shrink-0 items-center gap-1.5 text-xs text-muted" transition:fade><span class="icon-[lucide--loader-circle] size-3.5 animate-spin"></span><span class="@max-4xl:hidden">Adding {library.importing}…</span></span>
			{/if}
			{#if library.view.kind !== 'recent'}
				<div class="flex items-center">
					<CycleButton title="Sort by" options={sortByOptions} value={settings.values.sortBy} onchange={(v) => settings.set('sortBy', v)} showLabel labelClass="@max-4xl:hidden" class="h-8" />
					<CycleButton title="Order" options={orderOptions} value={settings.values.sortDesc} onchange={(v) => settings.set('sortDesc', v)} showLabel reserve={orderLabels} labelClass="@max-4xl:hidden" class="h-8" />
				</div>
			{:else}
				<CycleButton title="Recent" options={recentOptions} value={settings.values.recentWindow} onchange={(v) => settings.set('recentWindow', v)} showLabel labelClass="@max-4xl:hidden" class="h-8" />
			{/if}
			<ToggleGroup class="@max-2xl:hidden" label="Show papers" value={settings.values.readFilter} onValueChange={(v) => settings.set('readFilter', v)} items={readOptions.map((o) => ({ value: o.value, label: o.value === 'all' ? 'All' : o.label }))} />
			<label class="flex h-8 w-64 min-w-28 shrink-[4] items-center gap-2 rounded-lg bg-stone-200/60 pr-1.5 pl-2.5 ring-blue-500 dark:ring-blue-400 focus-within:bg-white focus-within:ring-2 dark:bg-stone-800/60 dark:focus-within:bg-stone-900">
				<span class="icon-[lucide--search] size-3.5 shrink-0 text-stone-400"></span>
				<input
					{...verbatim}
					bind:this={search}
					bind:value={library.query}
					oninput={onSearchInput}
					onfocus={() => (searchFocused = true)}
					onblur={() => (searchFocused = false)}
					placeholder="Search papers"
					aria-label="Search papers"
					class="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted focus:placeholder:text-transparent"
				/>
				{#if library.query}
					<button class={iconButton(6, `${mutedIcon} size-5`)} aria-label="Clear search" onclick={() => ((library.query = ''), search?.focus())}><span class="icon-[lucide--x] size-3.5"></span></button>
				{:else if !searchFocused}
					<Kbd>{keys.search}</Kbd>
				{/if}
			</label>
			<AddPapers />
			<Tip label="Settings" shortcut={keys.settings}>
				{#snippet child({ props })}<button {...props} class={iconBtn} aria-label="Settings" onclick={() => (settingsDialog.open = true)}><span class="icon-[lucide--settings] size-4"></span></button>{/snippet}
			</Tip>
		</header>

		{#if library.error}
			<p class="mx-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{library.error}</p>
		{/if}

		<div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-10">
			{#if library.filtered.length}
				<!-- Cards move (flip) between views that share papers, and as searching and
				     tag filters re-flow; a view with none in common swaps the grid (a fade). -->
				{#key gridKey}
					{#if animated}
						<ul class="grid gap-5" style:grid-template-columns="repeat(auto-fill, minmax({minCard}px, 1fr))" in:fade={{ duration: 160 * motion }}>
							{#each library.filtered as paper (paper.id)}
								<li animate:flip={{ duration: 260 * motion, easing: cubicOut }} in:fade={{ duration: 160 * motion }} out:scale={{ start: 0.96, duration: 120 * motion }}>
									<PaperCard {paper} />
								</li>
							{/each}
						</ul>
					{:else}
						<!-- Too many to animate: only the rows on screen are rendered. -->
						<VirtualGrid items={library.filtered} key={(p) => p.id} min={minCard} gap={20} {scroller}>
							{#snippet cell(paper)}<PaperCard {paper} />{/snippet}
						</VirtualGrid>
					{/if}
				{/key}
			{:else}
				<div class="grid h-full place-items-center text-center text-sm text-muted" in:fade={{ duration: 160 * motion }}>
					<div>
						<p>{emptyMessage}</p>
						{#if filtering && inView.length}
							<button class={button('secondary', 'mt-3')} onclick={clearFilters}>Clear filters</button>
						{:else if !library.papers.length || !inView.length}
							<p class="mt-2 flex items-center justify-center gap-1">Drop PDFs here, press <Kbd>{keys.addPapers}</Kbd>, or paste an arXiv link</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>

