<!--
	The library's "+": one panel to add papers. Paste an arXiv link, search Hugging
	Face's papers (anything else typed), or drop PDF files on the zone (the window's
	drop handler imports them) or click it to pick.
-->
<script lang="ts" module>
	export const addPapers = $state({ open: false });
</script>

<script lang="ts">
	import { Popover } from 'bits-ui';
	import { scale } from 'svelte/transition';
	import { addFromArxiv, pickFiles } from '#lib/add-paper.js';
	import { parseArxiv } from '#lib/arxiv.js';
	import { searchHfPapers, type HfSearchResult } from '#lib/huggingface.js';
	import { library } from '#lib/library.svelte.js';
	import { keys } from '#lib/shortcuts.js';
	import Kbd from '#lib/ui/Kbd.svelte';
	import Tip from '#lib/ui/Tip.svelte';
	import { button, iconButton } from '#lib/ui/button.js';
	import { verbatim } from '#lib/ui/verbatim.js';

	let { class: className = '' }: { class?: string } = $props();
	let link = $state('');
	let dragging = $state(false);
	const valid = $derived(!!parseArxiv(link));

	// ── Hugging Face search: anything typed that isn't an arXiv link or id ──
	const query = $derived(link.trim());
	const searching = $derived(!valid && query.length >= 3);
	let results = $state.raw<HfSearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error' | 'offline'>('idle');
	let active = $state(0);
	let retries = $state(0);
	const inLibrary = $derived(new Set(library.papers.map((p) => p.arxiv).filter(Boolean)));

	// Debounced; each keystroke cancels the request before it.
	$effect(() => {
		void retries;
		if (!searching) {
			results = [];
			status = 'idle';
			return;
		}
		const q = query;
		const controller = new AbortController();
		status = 'loading';
		const timer = setTimeout(async () => {
			if (!navigator.onLine) return void (status = 'offline');
			try {
				results = await searchHfPapers(q, { signal: controller.signal });
				active = 0;
				status = 'done';
			} catch {
				if (!controller.signal.aborted) status = navigator.onLine ? 'error' : 'offline';
			}
		}, 300);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function add(text: string) {
		addPapers.open = false;
		link = '';
		void addFromArxiv(text);
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (valid) add(link);
		else if (searching && results[active]) add(results[active].arxiv);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!results.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
		e.preventDefault();
		active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
		document.getElementById(`hf-result-${active}`)?.scrollIntoView({ block: 'nearest' });
	}

	function pick() {
		addPapers.open = false;
		void pickFiles();
	}

	const byline = (r: HfSearchResult) => (r.authors.length > 2 ? `${r.authors[0]} et al.` : r.authors.join(', '));
</script>

<Popover.Root bind:open={addPapers.open} onOpenChange={(o) => !o && ((link = ''), (dragging = false))}>
	<Tip label="Add papers">
		{#snippet child({ props })}
			<Popover.Trigger {...props} aria-label="Add papers" class={iconButton(8, className)}>
				<span class="icon-[lucide--plus] size-4"></span>
			</Popover.Trigger>
		{/snippet}
	</Tip>
	<Popover.Portal>
		<Popover.Content sideOffset={8} align="end" forceMount>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:scale={{ start: 0.96, duration: 120 }} class="z-(--z-menu) w-96 space-y-3 rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-800 shadow-xl outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
							<form class="flex gap-2" onsubmit={submit}>
								<label class="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-stone-100 px-2.5 ring-blue-500 dark:ring-blue-400 focus-within:ring-2 dark:bg-stone-800">
									<span class="{searching ? 'icon-[lucide--search]' : 'icon-[lucide--link]'} size-3.5 shrink-0 text-stone-400"></span>
									<!-- svelte-ignore a11y_autofocus -->
									<input
										{...verbatim}
										bind:value={link}
										{onkeydown}
										autofocus
										placeholder="arXiv link, or Search on Hugging Face"
										aria-label="arXiv link or id, or search on Hugging Face"
										role="combobox"
										aria-expanded={searching && results.length > 0}
										aria-controls="hf-results"
										aria-activedescendant={searching && results.length ? `hf-result-${active}` : undefined}
										aria-autocomplete="list"
										class="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
									/>
									{#if status === 'loading'}<span class="icon-[lucide--loader-circle] size-3.5 shrink-0 animate-spin text-stone-400" aria-label="Searching"></span>{/if}
								</label>
								<button type="submit" class={button('primary')} disabled={!valid && !(searching && results[active])}>Add</button>
							</form>
							{#if searching}
								{#if status === 'offline'}
									<p class="flex items-center gap-2 px-1 py-2 text-[13px] text-muted"><span class="icon-[lucide--wifi-off] size-4 shrink-0"></span>You're offline: searching Hugging Face needs the internet.</p>
								{:else if status === 'error'}
									<p class="flex items-center gap-2 px-1 py-2 text-[13px] text-muted">
										<span class="icon-[lucide--circle-alert] size-4 shrink-0"></span>Hugging Face didn't answer.
										<button type="button" class="font-medium text-stone-700 underline-offset-2 hover:underline dark:text-stone-200" onclick={() => retries++}>Try again</button>
									</p>
								{:else if status === 'done' && !results.length}
									<p class="px-1 py-2 text-[13px] text-muted">No papers found on Hugging Face.</p>
								{:else if results.length}
									<div id="hf-results" role="listbox" aria-label="Papers on Hugging Face" class="-mx-1 max-h-80 space-y-0.5 overflow-y-auto {status === 'loading' ? 'opacity-60' : ''}">
										{#each results as r, i (r.arxiv)}
											<!-- Options of the combobox above: the input keeps focus (arrows, Enter). -->
											<div
												id="hf-result-{i}"
												role="option"
												tabindex="-1"
												aria-selected={i === active}
												class="cursor-default rounded-lg px-2 py-1.5 aria-selected:bg-stone-100 dark:aria-selected:bg-stone-800"
												onpointermove={() => (active = i)}
												onclick={() => add(r.arxiv)}
												onkeydown={(e) => e.key === 'Enter' && add(r.arxiv)}
											>
												<p class="line-clamp-2 text-[13px] leading-snug font-medium">{r.title}</p>
												<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
													<span class="min-w-0 truncate">{byline(r)}{r.year ? ` · ${r.year}` : ''}</span>
													<span class="shrink-0 font-mono text-[11px]">{r.arxiv}</span>
													{#if inLibrary.has(r.arxiv)}<span class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-200/70 px-1.5 py-px text-[11px] text-stone-600 dark:bg-stone-700 dark:text-stone-300"><span class="icon-[lucide--check] size-3"></span>In library</span>{/if}
												</p>
											</div>
										{/each}
									</div>
								{/if}
								{#if results.length && status !== 'offline' && status !== 'error'}<p class="flex items-center gap-1 px-1 text-xs text-muted"><Kbd>↑</Kbd><Kbd>↓</Kbd> to choose, <Kbd>↵</Kbd> to add · from huggingface.co/papers</p>{/if}
							{:else}
								<button
									type="button"
									class="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-3 py-5 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 {dragging ? 'border-stone-500 bg-stone-100 dark:border-stone-400 dark:bg-stone-800' : 'border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800/60'}"
									onclick={pick}
									ondragenter={() => (dragging = true)}
									ondragleave={() => (dragging = false)}
									ondrop={() => (addPapers.open = false)}
								>
									<span class="icon-[lucide--file-up] size-5 text-stone-400"></span>
									<span class="text-[13px] text-stone-700 dark:text-stone-200">Drop PDF files, or click to choose</span>
									<span class="flex items-center gap-1 text-xs text-muted">or press <Kbd>{keys.addPapers}</Kbd></span>
								</button>
							{/if}
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
