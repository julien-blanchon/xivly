import { describe, expect, it } from 'vitest';
import { filterPapers, type FilterOptions } from './filter';
import type { Paper } from './types';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const day = 864e5;
const paper = (p: Partial<Paper> & { id: string }): Paper => ({ title: p.id, added: '', ...p }) as Paper;
const options = (o: Partial<FilterOptions> = {}): FilterOptions => ({
	view: { kind: 'all' },
	tagFilter: {},
	readFilter: 'all',
	recentSince: NOW - 7 * day,
	query: '',
	sortBy: 'added',
	sortDesc: true,
	isCategory: (id) => id === 'vision',
	...o
});
const ids = (ps: Paper[]) => ps.map((p) => p.id);

const papers = [
	paper({ id: 'a', title: 'Attention', added: '2026-01-01', tags: ['llm'], category: 'vision', read: '2026-02-01' }),
	paper({ id: 'b', title: 'Book 10', added: '2026-03-01', tags: ['llm', 'archived'], opened: new Date(NOW - day).toISOString() }),
	paper({ id: 'c', title: 'Book 9', added: '2026-02-01', category: 'gone', opened: new Date(NOW - 20 * day).toISOString(), abstract: 'diffusion models' }),
	paper({ id: 'd', title: 'Draft', added: '' })
];

describe('filterPapers', () => {
	it('sorts by date added, newest first, papers without a date last', () => {
		expect(ids(filterPapers(papers, options()))).toEqual(['b', 'c', 'a', 'd']);
		expect(ids(filterPapers(papers, options({ sortDesc: false })))).toEqual(['a', 'c', 'b', 'd']);
	});
	it('sorts titles with numbers in numeric order', () => {
		expect(ids(filterPapers(papers, options({ sortBy: 'title', sortDesc: false })))).toEqual(['a', 'c', 'b', 'd']);
	});
	it('filters tags in and out', () => {
		expect(ids(filterPapers(papers, options({ tagFilter: { llm: 'in' } })))).toEqual(['b', 'a']);
		expect(ids(filterPapers(papers, options({ tagFilter: { archived: 'out' } })))).toEqual(['c', 'a', 'd']);
	});
	it('filters read state', () => {
		expect(ids(filterPapers(papers, options({ readFilter: 'read' })))).toEqual(['a']);
		expect(ids(filterPapers(papers, options({ readFilter: 'unread' })))).toEqual(['b', 'c', 'd']);
	});
	it('shows recent papers in the window, most recently opened first', () => {
		expect(ids(filterPapers(papers, options({ view: { kind: 'recent' } })))).toEqual(['b']);
		expect(ids(filterPapers(papers, options({ view: { kind: 'recent' }, recentSince: NOW - 30 * day })))).toEqual(['b', 'c']);
	});
	it('counts papers of unknown categories as uncategorized', () => {
		expect(ids(filterPapers(papers, options({ view: { kind: 'uncategorized' } })))).toEqual(['b', 'c', 'd']);
		expect(ids(filterPapers(papers, options({ view: { kind: 'category', id: 'vision' } })))).toEqual(['a']);
	});
	it('searches titles, abstracts and tags', () => {
		expect(ids(filterPapers(papers, options({ query: ' DIFFUSION ' })))).toEqual(['c']);
		expect(ids(filterPapers(papers, options({ query: 'llm' })))).toEqual(['b', 'a']);
	});

	it('finds and sorts LaTeX titles as shown', () => {
		const ps = [paper({ id: 'x', title: '$\\alpha$-Divergence' }), paper({ id: 'y', title: 'Beta' })];
		expect(ids(filterPapers(ps, options({ query: 'α-div' })))).toEqual(['x']);
		expect(ids(filterPapers(ps, options({ query: 'alpha' })))).toEqual(['x']);
		expect(ids(filterPapers(ps, options({ sortBy: 'title', sortDesc: false })))).toEqual(['y', 'x']);
	});
});
