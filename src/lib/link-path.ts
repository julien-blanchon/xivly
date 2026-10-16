// A paper link written as the path, after the app's own address:
// /xivly/https://arxiv.org/abs/1706.03762, /xivly/1706.03762, /xivly/abs/1706.03762
// (an arXiv link with only its host swapped), or a PDF's link. The page at that
// path turns it into `/?add=<link>` (open-url.svelte.ts).
import { parseArxiv } from './arxiv';

/** The link in `path` (after the base path, with its `?query`), or null when it isn't one. */
export function linkFromPath(path: string, search = ''): string | null {
	const s = path.replace(/^\/+/, '');
	// arxiv.org paths: abs/<id>, pdf/<id>(.pdf), html/<id>.
	const arxiv = s.replace(/^(?:abs|pdf|html)\//i, '');
	if (parseArxiv(arxiv)) return arxiv;
	// Some servers and tools merge the `//` after the scheme.
	const scheme = /^(https?):\/+/i.exec(s);
	if (scheme) return `${scheme[1].toLowerCase()}://${s.slice(scheme[0].length)}${search}`;
	// A link without its scheme: arxiv.org/abs/…, example.com/paper.pdf.
	if (/^[a-z\d-]+(?:\.[a-z\d-]+)+\//i.test(s)) return `https://${s}${search}`;
	return null;
}
