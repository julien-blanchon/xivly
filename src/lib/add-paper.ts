// Adding papers: PDF files, or an arXiv link / id (typed in the "+" panel, or pasted).
// A paper already in the library (same file, arXiv id or DOI) is asked about first.
import { parseArxiv } from './arxiv';
import { toast } from './components/Toasts.svelte';
import { findDuplicate, sha256 } from './duplicates';
import { latexToUnicode } from './latex';
import { ARCHIVED, library } from './library.svelte';
import type { Paper } from './types';
import { prompts } from './ui/prompt.svelte';
import { openPaper, openPaperWhenReady } from './windows';

/** New papers open right away (a handful at most, when many are dropped at once). */
const MAX_OPEN = 4;

const isArchived = (p: Paper) => !!p.tags?.includes(ARCHIVED);

// One question at a time (a new prompt would cancel the one still open).
let asking: Promise<unknown> = Promise.resolve();

/** "Already in your library": open that one (unarchived, if it was), import a copy, or neither. */
function askDuplicate(p: Paper): Promise<'open' | 'import' | null> {
	const archived = isArchived(p);
	const answer = asking.then(() =>
		prompts.choose(
			'Already in your library',
			[
				{ value: 'import', label: 'Import anyway' },
				{ value: 'open', label: archived ? 'Unarchive and open' : 'Open it' }
			],
			{ message: `“${latexToUnicode(p.title)}”${archived ? ' is archived, so it’s hidden from the library.' : ''}` }
		)
	);
	asking = answer;
	return answer;
}

/** Open a paper already there (in the click on "Open it": the web opens tabs only in a gesture). */
function openExisting(p: Paper) {
	void openPaper(p.id, p.title);
	if (isArchived(p)) void library.toggleTag(p.id, ARCHIVED).catch((e) => toast(String(e), 'error'));
}

/** Import files and open what was added. Call it in the user's gesture. */
export async function addFiles(files: File[]) {
	const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
	// The same file again: asked before any tab opens (on the web it would cover the question).
	const asked = new Set<File>();
	const skipped = new Set<File>();
	for (const file of pdfs) {
		const existing = findDuplicate(library.papers, { sha256: await sha256(await file.arrayBuffer()) });
		if (!existing) continue;
		const answer = await askDuplicate(existing);
		asked.add(file);
		if (answer === 'import') continue;
		skipped.add(file);
		if (answer === 'open') openExisting(existing);
	}
	const todo = pdfs.filter((f) => !skipped.has(f));
	const pending = new Map(todo.slice(0, MAX_OPEN).map((f) => [f, openPaperWhenReady()]));
	/** Files whose tab was closed for a question: opened later, if added after all. */
	const reopen = new Set<File>();
	const ids = new Map<File, string>();
	await library.import(todo, {
		added: (file, id) => ids.set(file, id),
		// The same paper in another file (arXiv id or DOI), found once its metadata is read.
		keep: async (file, meta) => {
			const existing = asked.has(file) ? undefined : findDuplicate(library.papers, meta);
			if (!existing) return true;
			if (pending.has(file)) {
				pending.get(file)!.cancel();
				pending.delete(file);
				reopen.add(file);
			}
			const answer = await askDuplicate(existing);
			if (answer === 'import') return true;
			skipped.add(file);
			if (answer === 'open') openExisting(existing);
			return false;
		}
	});
	for (const f of todo) {
		const id = ids.get(f);
		const p = pending.get(f);
		if (!id) p?.cancel();
		else if (p) void p.open(id, library.get(id)?.title);
		else if (reopen.has(f)) void openPaper(id, library.get(id)?.title);
	}
}

/** The file picker, then open what was added. */
export async function pickFiles() {
	await addFiles(await library.pickFiles());
}

export async function addFromArxiv(text: string) {
	if (!parseArxiv(text)) return toast('That isn’t an arXiv link or id', 'error');
	const pending = openPaperWhenReady();
	try {
		const { id, existed } = await library.importArxiv(text);
		const paper = library.get(id);
		const title = latexToUnicode(paper?.title ?? id);
		if (paper && existed && isArchived(paper)) toast(`Already in your library, archived: ${title}`, 'info', { label: 'Unarchive', run: () => void library.toggleTag(id, ARCHIVED).catch((e) => toast(String(e), 'error')) });
		else if (existed) toast(`Already in your library: ${title}`);
		void pending.open(id, title);
	} catch (e) {
		pending.cancel();
		toast(String(e), 'error');
	}
}

/** Library window: pasting an arXiv link or PDF files adds them. */
export function onLibraryPaste(e: ClipboardEvent) {
	const t = e.target as HTMLElement | null;
	if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '')) return;
	const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type === 'application/pdf');
	const text = e.clipboardData?.getData('text/plain') ?? '';
	if (files.length) {
		e.preventDefault();
		void addFiles(files);
	} else if (parseArxiv(text)) {
		e.preventDefault();
		void addFromArxiv(text);
	}
}
