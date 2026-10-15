// Which papers the library grid shows, and in what order. Pure, so it can be tested.
import { latexToUnicode } from './latex';
import type { SortKey } from './settings.svelte';
import type { Paper } from './types';

export type View = { kind: 'all' } | { kind: 'recent' } | { kind: 'uncategorized' } | { kind: 'category'; id: string };

export interface FilterOptions {
	view: View;
	/** 'in': only papers with the tag; 'out': papers without it. */
	tagFilter: Record<string, 'in' | 'out'>;
	readFilter: 'all' | 'unread' | 'read';
	/** Papers opened since then count as recent (ms timestamp). */
	recentSince: number;
	query: string;
	sortBy: SortKey;
	sortDesc: boolean;
	/** Is this a category of the library (ids missing from library.json count as uncategorized)? */
	isCategory: (id: string | undefined) => boolean;
}

/** Comparable string per sort order ('' when the paper has no value for it). */
const sortKeys: Record<SortKey, (p: Paper) => string> = {
	added: (p) => p.added ?? '',
	opened: (p) => p.opened ?? '',
	// Full date when known (YYYY-MM-DD sorts as text), else the year.
	published: (p) => p.date ?? (p.year ? String(p.year) : ''),
	// As shown: "$\alpha$-…" sorts under α, not $.
	title: (p) => latexToUnicode(p.title)
};

// Built once per paper object (an edit replaces the object): typing a search
// doesn't rebuild a thousand abstracts per keystroke.
const haystacks = new WeakMap<Paper, string>();
function haystack(p: Paper) {
	let h = haystacks.get(p);
	if (h === undefined) {
		// The title raw ("\alpha") and as shown ("α"): either finds it.
		const shown = latexToUnicode(p.title);
		h = [p.title, shown !== p.title && shown, p.authors?.join(' '), p.abstract, p.year, p.arxiv, p.doi, p.tags?.join(' ')]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		haystacks.set(p, h);
	}
	return h;
}

// The same orders as `localeCompare` (with and without options), many times faster.
const byValue = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;
const byTitle = new Intl.Collator().compare;

export function filterPapers(papers: Paper[], o: FilterOptions): Paper[] {
	const q = o.query.trim().toLowerCase();
	const v = o.view;
	const list = papers.filter((p) => {
		if (v.kind === 'category' && p.category !== v.id) return false;
		if (v.kind === 'uncategorized' && o.isCategory(p.category)) return false;
		if (v.kind === 'recent' && !(p.opened && Date.parse(p.opened) >= o.recentSince)) return false;
		for (const [t, mode] of Object.entries(o.tagFilter)) if (!!p.tags?.includes(t) !== (mode === 'in')) return false;
		if (o.readFilter !== 'all' && !!p.read !== (o.readFilter === 'read')) return false;
		return !q || haystack(p).includes(q);
	});
	// Recent is always most recently opened first.
	const recent = v.kind === 'recent';
	const key = sortKeys[recent ? 'opened' : o.sortBy] ?? sortKeys.added;
	const dir = recent || o.sortDesc ? -1 : 1;
	// Papers without the value (never opened, no date…) go last either way.
	return list.toSorted((a, b) => {
		const x = key(a),
			y = key(b);
		if (!x || !y) return x ? -1 : y ? 1 : byTitle(a.title, b.title);
		return dir * byValue(x, y) || byTitle(a.title, b.title);
	});
}
