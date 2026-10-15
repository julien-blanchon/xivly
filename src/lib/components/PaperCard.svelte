<script lang="ts">
	import { coverUrl, loadedCover, whenNear } from '#lib/covers.js';
	import { coverVersions } from '#lib/cover-versions.svelte.js';
	import { latexToUnicode } from '#lib/latex.js';
	import { library } from '#lib/library.svelte.js';
	import { paperMenu } from '#lib/paper-menu.js';
	import { settings } from '#lib/settings.svelte.js';
	import { theme } from '#lib/theme.svelte.js';
	import type { Paper } from '#lib/types.js';
	import { contextMenu } from '#lib/ui/context-menu.svelte.js';
	import Tip from '#lib/ui/Tip.svelte';
	import { openPaper } from '#lib/windows.js';
	import { paperInk } from 'svelte-pdf-mini';
	import { untrack } from 'svelte';

	let { paper }: { paper: Paper } = $props();

	const style = $derived(settings.values.coverStyle);
	const color = $derived(library.color(paper));
	const category = $derived(library.category(paper.category));
	const title = $derived(latexToUnicode(paper.title));
	const bg = $derived(theme.dark ? color.dark : color.light);
	const authors = $derived(
		paper.authors?.length ? (paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')) : ''
	);

	// Page covers render lazily, once the card is near the viewport, and again when
	// the paper is saved (from any window).
	// A card is keyed by its paper: the cover loaded already shows from the first frame.
	let cover = $state<string | null>(untrack(() => loadedCover(paper.id)));
	let near = $state(false);
	function lazyCover(node: HTMLElement) {
		if (style !== 'page') return;
		return whenNear(node, () => (near = true));
	}
	$effect(() => {
		void coverVersions.of(paper.id);
		if (!near || style !== 'page') return;
		let live = true;
		coverUrl(paper.id).then((u) => live && (cover = u));
		return () => void (live = false);
	});

	const toggleRead = () => library.toggleRead(paper);
</script>

<!-- Click opens; right-click for everything else; the bookmark ribbon toggles read. -->
<div class="card relative" data-style={style} data-read={paper.read ? '' : undefined} style:--bg={bg} style:--accent={color.accent} {@attach lazyCover}>
	{#if style === 'stack'}<span class="sheet sheet-2" aria-hidden="true"></span><span class="sheet sheet-1" aria-hidden="true"></span>{/if}
	{#if style === 'book'}<span class="pages" aria-hidden="true"></span>{/if}
	<!-- The face moves as one piece (lift, book opening), ribbon included. -->
	<div class="face">
		<button
			class="cover flex aspect-[3/4] w-full flex-col overflow-hidden rounded-lg p-4 text-left outline-none ring-stone-500/60 ring-offset-2 ring-offset-stone-50 focus-visible:ring-2 dark:ring-offset-stone-950"
			onclick={() => openPaper(paper.id, paper.title)}
			{@attach contextMenu(() => paperMenu(paper))}
		>
			{#if style === 'page'}
				{#if cover}<img src={cover} alt="" class="page-img" draggable="false" />{/if}
				<span class="page-band">
					<span class="line-clamp-2 font-serif text-[13px] leading-snug text-stone-900 dark:text-stone-100">{title}</span>
					<span class="mt-0.5 line-clamp-1 text-[11px] text-stone-600 dark:text-stone-400">{authors}{paper.year ? ` · ${paper.year}` : ''}</span>
				</span>
			{:else}
				<span class="mr-5 text-[11px] font-medium tracking-wide uppercase" style:color={paperInk(color, theme.dark)}>{category?.name ?? ''}</span>
				<span class="mt-2 line-clamp-5 font-serif text-[17px] leading-snug text-stone-900 dark:text-stone-100">{title}</span>
				<span class="mt-auto pt-3 text-xs text-stone-600 dark:text-stone-400">
					<span class="line-clamp-1">{authors}</span>
					{#if paper.year}<span>{paper.year}</span>{/if}
					{#if paper.tags?.length}<span class="ml-1">{paper.tags.map((t) => `#${t}`).join(' ')}</span>{/if}
				</span>
			{/if}
			{#if style === 'book'}<span class="spine" aria-hidden="true"></span>{/if}
		</button>

		<Tip label={paper.read ? 'Mark as unread' : 'Mark as read'}>
			{#snippet child({ props })}
				<button {...props} class="ribbon" aria-pressed={!!paper.read} aria-label={paper.read ? 'Read' : 'Mark as read'} onclick={toggleRead}>
					<span class="icon-[lucide--check] size-2.5"></span>
				</button>
			{/snippet}
		</Tip>
	</div>
</div>

<style>
	.card {
		--ease: cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.face {
		position: relative;
		transition: transform 0.35s var(--ease);
	}
	.cover {
		position: relative;
		background: var(--bg);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
		transition: box-shadow 0.35s var(--ease);
	}

	/* ── Read: a bookmark ribbon hanging from the cover's top edge ── */
	.ribbon {
		position: absolute;
		top: 0;
		right: 0.9rem;
		z-index: 2;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 0.95rem;
		height: 1.1rem;
		padding-bottom: 0.45rem;
		color: transparent;
		background: color-mix(in oklab, var(--accent) 40%, transparent);
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%);
		opacity: 0;
		transition:
			opacity 0.15s,
			height 0.2s var(--ease),
			background 0.15s;
	}
	.card:hover .ribbon,
	.ribbon:focus-visible {
		opacity: 1;
	}
	.ribbon:hover {
		height: 1.6rem;
	}
	.card[data-read] .ribbon {
		opacity: 1;
		height: 1.6rem;
		color: white;
		background: var(--accent);
	}
	:global(.dark) .card[data-read] .ribbon {
		color: var(--color-stone-900);
	}

	/* ── flat: lift ─────────────────────────────────────────── */
	[data-style='flat']:hover .face {
		transform: translateY(-2px);
	}
	[data-style='flat']:hover .cover {
		box-shadow: 0 6px 16px rgb(0 0 0 / 0.1);
	}

	/* ── book: a hardcover that opens a little ──────────────── */
	[data-style='book'] {
		perspective: 1600px;
	}
	[data-style='book'] .face {
		transform-origin: left center;
	}
	[data-style='book'] .cover {
		border-radius: 3px 8px 8px 3px;
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.1),
			2px 2px 0 -1px rgb(0 0 0 / 0.04);
	}
	[data-style='book'] .spine {
		position: absolute;
		inset: 0 auto 0 0;
		width: 10px;
		background: linear-gradient(90deg, rgb(0 0 0 / 0.16), rgb(255 255 255 / 0.12) 60%, rgb(0 0 0 / 0.04));
	}
	[data-style='book'] .pages {
		position: absolute;
		inset: 3px 0 3px 6px;
		border-radius: 2px 6px 6px 2px;
		background: repeating-linear-gradient(90deg, #fbfaf7 0 2px, #e9e6df 2px 3px);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
	}
	[data-style='book']:hover .face {
		transform: rotateY(-20deg);
	}
	[data-style='book']:hover .cover {
		box-shadow: 10px 6px 20px rgb(0 0 0 / 0.16);
	}

	/* ── stack: sheets fan out ──────────────────────────────── */
	[data-style='stack'] .sheet {
		position: absolute;
		inset: 0;
		border-radius: 0.5rem;
		background: color-mix(in oklab, var(--bg) 55%, white);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
		transition: transform 0.35s var(--ease);
	}
	:global(.dark) [data-style='stack'] .sheet {
		background: color-mix(in oklab, var(--bg) 75%, black);
	}
	[data-style='stack'] .sheet-1 {
		transform: rotate(1.5deg) translate(2px, 1px);
	}
	[data-style='stack'] .sheet-2 {
		transform: rotate(-1.2deg) translate(-2px, 2px);
	}
	[data-style='stack']:hover .sheet-1 {
		transform: rotate(4deg) translate(8px, 2px);
	}
	[data-style='stack']:hover .sheet-2 {
		transform: rotate(-3.5deg) translate(-7px, 4px);
	}
	[data-style='stack']:hover .face {
		transform: translateY(-3px);
	}
	[data-style='stack']:hover .cover {
		box-shadow: 0 8px 18px rgb(0 0 0 / 0.12);
	}

	/* ── page: the paper's real first page ──────────────────── */
	[data-style='page'] .cover {
		padding: 0;
		background: white;
	}
	[data-style='page'] .page-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top;
		transition: transform 0.5s var(--ease);
	}
	[data-style='page'] .page-band {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		flex-direction: column;
		padding: 0.6rem 0.75rem 0.65rem;
		background: color-mix(in oklab, var(--bg) 92%, transparent);
		border-top: 3px solid var(--accent);
		backdrop-filter: blur(6px);
	}
	[data-style='page']:hover .face {
		transform: translateY(-2px);
	}
	[data-style='page']:hover .cover {
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.14);
	}
	[data-style='page']:hover .page-img {
		transform: scale(1.04);
	}

	@media (prefers-reduced-motion: reduce) {
		.face,
		.cover,
		.sheet,
		.page-img {
			transition: none !important;
		}
	}
</style>
