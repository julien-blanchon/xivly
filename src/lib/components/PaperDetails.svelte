<!-- Editable paper details: title, authors, year, category, tags, links. -->
<script lang="ts">
	import { iconButton, mutedIcon } from '#lib/ui/button.js';
	import { paperLinks } from '#lib/cite.js';
	import { hfListUrl } from '#lib/huggingface.js';
	import { onFlush } from '#lib/flush.js';
	import { library } from '#lib/library.svelte.js';
	import { addTag } from '#lib/paper-menu.js';
	import type { Snippet } from 'svelte';
	import { platform } from '#lib/platform/index.js';
	import type { Paper, PaperPatch } from '#lib/types.js';
	import Tip from '#lib/ui/Tip.svelte';
	import PaperActions from './PaperActions.svelte';
	import { toast } from './Toasts.svelte';
	import { verbatim } from '#lib/ui/verbatim.js';

	/**
	 * `actions`: extra buttons for the action row (the reader adds its exports).
	 * `footer`: render that row here, pinned to the bottom (a dialog puts it in its own footer).
	 */
	let { paper, actions, footer = true }: { paper: Paper; actions?: Snippet<[{ btn: string }]>; footer?: boolean } = $props();

	const save = (patch: PaperPatch, id = paper.id) => library.update(id, patch).catch((e) => toast(String(e), 'error'));

	// Title, authors and year save as you type (debounced), and right away on
	// blur, when the details close (Esc) and when the window closes or quits.
	// While a field is being edited it shows the text typed, not the saved value
	// (trimmed, tidied), so a save never rewrites what is being typed.
	type Text = 'title' | 'authors' | 'year';
	let draft = $state<Partial<Record<Text, string>>>({});
	/** The paper being edited, typed changes not saved yet, saves not written yet. */
	let draftOf = '';
	let pending = false;
	let writing = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function edit(key: Text, value: string) {
		if (draftOf !== paper.id) void flush('all');
		draftOf = paper.id;
		draft[key] = value;
		pending = true;
		clearTimeout(timer);
		timer = setTimeout(() => void flush(), 500);
	}

	/** Save what was typed; the `done` field (or all) shows the saved value again. */
	async function flush(done?: Text | 'all') {
		clearTimeout(timer);
		const patch: PaperPatch = {};
		// A paper always has a title.
		if (draft.title?.trim()) patch.title = draft.title.trim();
		if (draft.authors !== undefined) patch.authors = draft.authors.split(',').map((a) => a.trim()).filter(Boolean);
		if (draft.year !== undefined) patch.year = Number(draft.year) || null;
		if (done === 'all') draft = {};
		else if (done) delete draft[done];
		if (!pending || !Object.keys(patch).length) return;
		pending = false;
		writing++;
		await save(patch, draftOf).finally(() => writing--);
	}

	$effect(() => onFlush({ dirty: () => pending || writing > 0, flush: async () => (await flush(), true) }));
	// Another paper (the details dialog reused) or closing (Esc): the edits go to the paper they were made on.
	// (`paperId`, not `paper`: each save gives the paper a new object, same id.)
	const paperId = $derived(paper.id);
	$effect(() => {
		void paperId;
		return () => void flush('all');
	});

	const links = $derived(paperLinks(paper));
	const field = 'w-full rounded-md bg-transparent px-1 -mx-1 outline-none hover:bg-stone-200/50 focus:bg-white dark:hover:bg-stone-800/60 dark:focus:bg-stone-900 placeholder:text-muted';
	const label = 'mb-1.5 block text-[11px] font-medium tracking-wide text-muted uppercase';
</script>

<!-- Closing the tab (web): the save starts while the browser asks to leave. -->
<svelte:window onbeforeunload={() => void flush()} />

<div class="flex min-h-full flex-col gap-5 text-[13px]">
	<div>
		<textarea
			{...verbatim}
			class="{field} field-sizing-content resize-none font-serif text-lg leading-snug"
			value={draft.title ?? paper.title}
			aria-label="Title"
			oninput={(e) => edit('title', e.currentTarget.value)}
			onblur={() => flush('title')}
		></textarea>
		<!-- Wraps (papers can have 70+ authors), scrolls past a few lines. -->
		<textarea
			{...verbatim}
			class="{field} field-sizing-content max-h-24 resize-none overflow-y-auto text-stone-600 dark:text-stone-400"
			value={draft.authors ?? paper.authors?.join(', ') ?? ''}
			placeholder="Authors"
			aria-label="Authors"
			oninput={(e) => edit('authors', e.currentTarget.value)}
			onblur={() => flush('authors')}
		></textarea>
		<input {...verbatim} class="{field} w-20 text-stone-600 dark:text-stone-400" value={draft.year ?? paper.year ?? ''} placeholder="Year" aria-label="Year" inputmode="numeric" oninput={(e) => edit('year', e.currentTarget.value)} onblur={() => flush('year')} />
	</div>

	<div>
		<span class={label}>Category</span>
		<div class="flex flex-wrap gap-1">
			{#each library.categories as c (c.id)}
				{@const col = library.color({ category: c.id })}
				<!-- The category's own shade: light by day, dark by night (text follows). -->
				<button class="rounded-full bg-(--chip) px-2.5 py-0.5 text-xs text-stone-800 ring-stone-500 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 data-[active]:ring-1 dark:bg-(--chip-dark) dark:text-stone-200 dark:ring-stone-400" style:--chip={col.light} style:--chip-dark={col.dark} data-active={paper.category === c.id || undefined} aria-pressed={paper.category === c.id} onclick={() => save({ category: paper.category === c.id ? null : c.id })}>{c.name}</button>
			{/each}
		</div>
	</div>

	<div>
		<span class={label}>Tags</span>
		<div class="flex flex-wrap items-center gap-1">
			{#each paper.tags ?? [] as tag (tag)}
				<span class="inline-flex items-center gap-0.5 rounded-full bg-stone-200 py-0.5 pr-1 pl-2 text-xs dark:bg-stone-800">
					#{tag}
					<button class="grid size-4 place-items-center rounded-full text-muted outline-none hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400" aria-label="Remove tag {tag}" onclick={() => library.toggleTag(paper.id, tag).catch((e) => toast(String(e), 'error'))}><span class="icon-[lucide--x] size-3"></span></button>
				</span>
			{/each}
			<Tip label="Add a tag">
				{#snippet child({ props })}<button {...props} class={iconButton(6, `${mutedIcon} rounded-full`)} aria-label="Add tag" onclick={() => addTag(paper)}><span class="icon-[lucide--plus] size-3.5"></span></button>{/snippet}
			</Tip>
		</div>
	</div>

	{#if paper.hf?.page}
		{@const hf = paper.hf}
		<div>
			<span class={label}>Hugging Face</span>
			<ul class="space-y-0.5">
				<li>
					<button class="-mx-1 flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-stone-200/60 dark:hover:bg-stone-800/60" onclick={() => platform.openUrl(hf.page!)}>
						<span class="icon-[lucide--smile] size-3.5 shrink-0 text-stone-500"></span><span class="flex-1 truncate">Paper page</span>
						{#if hf.upvotes}<span class="flex items-center gap-0.5 text-xs text-muted tabular-nums"><span class="icon-[lucide--triangle] size-2.5"></span>{hf.upvotes}</span>{/if}
					</button>
				</li>
				{#each [['models', 'Models', 'icon-[lucide--box]'], ['datasets', 'Datasets', 'icon-[lucide--database]'], ['spaces', 'Spaces', 'icon-[lucide--rocket]']] as const as [kind, name, icon] (kind)}
					{@const repos = hf[kind]}
					{#if repos && paper.arxiv}
						<li>
							<button class="-mx-1 flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-stone-200/60 dark:hover:bg-stone-800/60" onclick={() => platform.openUrl(hfListUrl(kind, paper.arxiv!))}>
								<span class="{icon} size-3.5 shrink-0 text-stone-500"></span><span class="flex-1 truncate">{name} citing this paper</span>
								<span class="text-xs text-muted tabular-nums">{repos.total}</span>
							</button>
							<ul class="mb-1 ml-5.5">
								{#each repos.top as id (id)}
									<li>
										<button class="-mx-1 block w-full truncate rounded-md px-1 text-left text-xs text-muted hover:bg-stone-200/60 hover:text-stone-800 dark:hover:bg-stone-800/60 dark:hover:text-stone-200" onclick={() => platform.openUrl(`https://huggingface.co/${kind === 'models' ? '' : `${kind}/`}${id}`)}>{id}</button>
									</li>
								{/each}
							</ul>
						</li>
					{/if}
				{/each}
			</ul>
		</div>
	{/if}

	{#if links.length}
		<div>
			<span class={label}>Links</span>
			<ul class="space-y-0.5">
				{#each links as l (l.url)}
					<li>
						<button class="-mx-1 flex w-full items-center gap-2 truncate rounded-md px-1 py-0.5 text-left hover:bg-stone-200/60 dark:hover:bg-stone-800/60" onclick={() => platform.openUrl(l.url)} title={l.url}>
							<span class="{l.icon} size-3.5 shrink-0 text-stone-500"></span><span class="truncate">{l.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if footer}
		<!-- Pinned to the bottom of the scrolling panel. -->
		<PaperActions {paper} {actions} class="sticky bottom-0 mt-auto border-t border-stone-200 bg-stone-50 py-2 dark:border-stone-800 dark:bg-stone-900" />
	{/if}
</div>
