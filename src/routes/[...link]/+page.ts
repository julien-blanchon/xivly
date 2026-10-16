// A paper link as the path (/xivly/https://arxiv.org/abs/1706.03762, /xivly/1706.03762):
// opens as `/?add=<link>` (open-url.svelte.ts). Any other path is still a 404.
import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { linkFromPath } from '#lib/link-path.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
	const link = linkFromPath(params.link, url.search);
	if (!link) error(404, 'Not found');
	redirect(307, `${resolve('/')}?add=${encodeURIComponent(link)}`);
};
