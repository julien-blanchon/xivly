// The menu for a paper: a card's right-click in the library.
import { paperLinks } from './cite';
import { toast } from './components/Toasts.svelte';
import { detailsDialog } from './components/DetailsDialog.svelte';
import { latexToUnicode } from './latex';
import { ARCHIVED, library } from './library.svelte';
import { fileManager, trashName } from './os';
import { platform } from './platform';
import type { Paper } from './types';
import type { MenuItem } from './ui/context-menu.svelte';
import { prompts } from './ui/prompt.svelte';
import { openPaper } from './windows';

const fail = (e: unknown) => toast(String(e), 'error');

export async function addTag(p: Paper) {
	const raw = await prompts.ask('New tag', { placeholder: 'e.g. transformers', confirmLabel: 'Add' });
	const tag = raw?.replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
	if (tag && !p.tags?.includes(tag)) await library.toggleTag(p.id, tag).catch(fail);
}

export async function trashPaper(p: Paper) {
	const ok = await prompts.confirm(`Move “${latexToUnicode(p.title)}” to the ${trashName}?`, {
		message: platform.kind === 'desktop' ? `Its folder goes to the ${trashName}.` : 'Its folder goes to .xivly/trash in your library, kept there for 30 days.',
		confirmLabel: `Move to ${trashName}`,
		danger: true
	});
	if (ok) await library.remove(p.id).catch(fail);
	return ok;
}

/** Archiving is the `archived` tag (hidden by default in the library). */
function toggleArchived(p: Paper): MenuItem {
	const archived = !!p.tags?.includes(ARCHIVED);
	return {
		label: archived ? 'Unarchive' : 'Archive',
		icon: archived ? 'icon-[lucide--archive-restore]' : 'icon-[lucide--archive]',
		separatorBefore: true,
		onSelect: () => library.toggleTag(p.id, ARCHIVED).catch(fail)
	};
}

export function paperMenu(p: Paper): MenuItem[] {
	const links = paperLinks(p);
	const items: MenuItem[] = [];
	items.push({ label: 'Open', icon: 'icon-[lucide--book-open]', shortcut: '↵', onSelect: () => openPaper(p.id, p.title) });
	items.push(
		p.read
			? { label: 'Mark as unread', icon: 'icon-[lucide--circle-dashed]', onSelect: () => library.toggleRead(p) }
			: { label: 'Mark as read', icon: 'icon-[lucide--circle-check]', onSelect: () => library.toggleRead(p) }
	);
	items.push(
		{
			label: 'Category',
			icon: 'icon-[lucide--folder]',
			separatorBefore: true,
			items: [
				...library.categories.map((c) => ({
					label: c.name,
					color: library.color({ category: c.id }).accent,
					checked: p.category === c.id,
					onSelect: () => library.update(p.id, { category: c.id }).catch(fail)
				})),
				{ label: 'None', icon: 'icon-[lucide--circle-off]', checked: !library.category(p.category), separatorBefore: true, onSelect: () => library.update(p.id, { category: null }).catch(fail) }
			]
		},
		{
			label: 'Tags',
			icon: 'icon-[lucide--tag]',
			items: [
				...library.allTags.map((t) => ({
					label: `#${t}`,
					checked: p.tags?.includes(t),
					onSelect: () => library.toggleTag(p.id, t).catch(fail)
				})),
				{ label: 'New tag…', icon: 'icon-[lucide--plus]', separatorBefore: library.allTags.length > 0, onSelect: () => addTag(p) }
			]
		}
	);
	if (links.length)
		items.push({ label: 'Links', icon: 'icon-[lucide--link]', items: links.map((l) => ({ label: l.label, icon: l.icon, onSelect: () => platform.openUrl(l.url) })) });
	items.push({ label: 'Edit details…', icon: 'icon-[lucide--pencil]', separatorBefore: true, onSelect: () => detailsDialog.show(p.id) });
	if (platform.reveal) items.push({ label: `Show in ${fileManager}`, icon: 'icon-[lucide--folder-search]', onSelect: () => platform.reveal?.(`papers/${p.id}/paper.pdf`) });
	items.push(
		{ label: 'Refresh metadata', icon: 'icon-[lucide--refresh-cw]', onSelect: () => library.refreshMetadata(p.id).then(() => toast('Metadata updated'), fail) },
		toggleArchived(p),
		{ label: `Move to ${trashName}`, icon: 'icon-[lucide--trash-2]', danger: true, onSelect: () => trashPaper(p) }
	);
	return items;
}

