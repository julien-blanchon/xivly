// `?add=<url>` (`#/?add=` in the Chrome extension): adds the paper at that link
// (arXiv, or any PDF) once the library is open, then reads it in this tab.
// Web: https://julien-blanchon.github.io/xivly/?add=https://arxiv.org/abs/1706.03762.
// The extension's "Open in Xivly" opens these, with steps of its own (extension/app.svelte.ts).
import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { parseArxiv } from './arxiv';
import { toast } from './components/Toasts.svelte';
import { library } from './library.svelte';
import { isPdf } from './repo';
import { searchParams } from './windows';

export interface OpenUrlSteps {
	/** Fetch the PDF; null: cancelled. Default: only sites that let others download their PDFs (CORS). */
	download?: (url: string) => Promise<Response | null>;
	/** True when the paper was shown elsewhere instead (extension: its reader tab). */
	shownElsewhere?: (id: string) => Promise<boolean>;
}

export function openUrlParam(steps: OpenUrlSteps = {}) {
	// Once the library is open (the web may need a click on its folder first).
	$effect.root(() => {
		$effect(() => {
			const url = searchParams(page.url).get('add');
			if (url && library.status === 'ready') untrack(() => void open(url, steps));
		});
	});
}

async function open(url: string, steps: OpenUrlSteps) {
	// A reload must not add it again.
	await goto(resolve('/'), { replace: true });
	try {
		const id = parseArxiv(url) ? (await library.importArxiv(url)).id : await importPdf(url, steps.download ?? download);
		if (!id || (await steps.shownElsewhere?.(id))) return;
		await goto(`${resolve('/read')}?id=${encodeURIComponent(id)}`, { replace: true });
	} catch (e) {
		toast(e instanceof Error ? e.message : String(e), 'error');
	}
}

/** Any PDF on the web; the link is kept (`links.other`), so the same one opens its paper again. */
async function importPdf(url: string, download: (url: string) => Promise<Response | null>): Promise<string | undefined> {
	if (!/^https?:$/.test(URL.parse(url)?.protocol ?? '')) throw new Error('That isn’t a link to a paper');
	const existing = library.papers.find((p) => p.links?.other?.includes(url));
	if (existing) return existing.id;
	const res = await download(url);
	if (!res) return;
	if (!res.ok) throw new Error(`${new URL(res.url || url).host}: HTTP ${res.status}`);
	const bytes = new Uint8Array(await res.arrayBuffer());
	if (!isPdf(bytes)) throw new Error('That isn’t a PDF');
	const name = decodeURIComponent(new URL(res.url || url).pathname.split('/').pop() ?? '').replace(/\.pdf$/i, '') || 'paper';
	const [id] = await library.import([new File([bytes], `${name}.pdf`, { type: 'application/pdf' })]);
	if (id) await library.update(id, (cur) => ({ links: { ...cur.links, other: [...(cur.links?.other ?? []), url] } }));
	return id;
}

async function download(url: string) {
	try {
		return await fetch(url);
	} catch (e) {
		// A network error, or (most often) no CORS: the browser hides which.
		if (e instanceof TypeError) throw new Error(`${new URL(url).host} doesn’t allow other sites to download its PDFs: download it, then drop it here.`);
		throw e;
	}
}
