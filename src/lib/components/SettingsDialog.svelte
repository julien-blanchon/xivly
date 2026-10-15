<!-- Settings (⌘, / Ctrl+,): every option is live; stored per platform and synced across windows. -->
<script module lang="ts">
	export const settingsDialog = $state({ open: false, section: 'general' as Section });
	type Section = 'general' | 'reading' | 'layout' | 'annotations' | 'saving' | 'research' | 'library' | 'hooks' | 'shortcuts';
</script>

<script lang="ts">
	import { button, iconButton, mutedIcon } from '#lib/ui/button.js';
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import UiDialog from '#lib/ui/Dialog.svelte';
	import { library } from '#lib/library.svelte.js';
	import { platform } from '#lib/platform/index.js';
	import { coverStyles, settings, type SettingKey, type Settings } from '#lib/settings.svelte.js';
	import { keys, shortcuts } from '#lib/shortcuts.js';
	import { mac, trashName } from '#lib/os.js';
	import { sortOptions } from '#lib/sort-menu.js';
	import { downloadStarter, hasStarter, removeStarter, starter, STARTER_TAG } from '#lib/onboarding/starter.svelte.js';
	import { prompts } from '#lib/ui/prompt.svelte.js';
	import { toast } from './Toasts.svelte';

	async function removeExamples() {
		const n = library.papers.filter((p) => p.tags?.includes(STARTER_TAG)).length;
		if (await prompts.confirm(`Move the ${n} example papers to the ${trashName}?`, { confirmLabel: `Move to ${trashName}`, danger: true })) await removeStarter().catch((e) => toast(String(e), 'error'));
	}
	import Kbd from '#lib/ui/Kbd.svelte';
	import NoteEmojiSettings from './NoteEmojiSettings.svelte';
	import TextBoxFontSettings from './TextBoxFontSettings.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import ToggleGroup from '#lib/ui/ToggleGroup.svelte';
	import { verbatim } from '#lib/ui/verbatim.js';

	const s = $derived(settings.values);
	const set = <K extends SettingKey>(k: K) => (v: Settings[K]) => settings.set(k, v);

	const sections: { id: Section; label: string; icon: string; desktop?: boolean }[] = [
		{ id: 'general', label: 'General', icon: 'icon-[lucide--settings-2]' },
		{ id: 'reading', label: 'Page look', icon: 'icon-[lucide--palette]' },
		{ id: 'layout', label: 'Layout & zoom', icon: 'icon-[lucide--columns-2]' },
		{ id: 'annotations', label: 'Annotations', icon: 'icon-[lucide--highlighter]' },
		{ id: 'saving', label: 'Saving', icon: 'icon-[lucide--save]' },
		{ id: 'research', label: 'Research', icon: 'icon-[lucide--graduation-cap]' },
		{ id: 'library', label: 'Library', icon: 'icon-[lucide--library]' },
		{ id: 'hooks', label: 'Hooks', icon: 'icon-[lucide--webhook]', desktop: true },
		{ id: 'shortcuts', label: 'Shortcuts', icon: 'icon-[lucide--keyboard]' }
	];
	const visible = $derived(sections.filter((x) => !x.desktop || platform.kind === 'desktop'));
</script>

{#snippet row(label: string, hint: string, control: Snippet)}
	<div class="flex items-center justify-between gap-6 border-b border-stone-100 py-3 last:border-0 dark:border-stone-800">
		<div class="min-w-0">
			<p class="text-[13px] font-medium">{label}</p>
			{#if hint}<p class="text-xs text-muted">{hint}</p>{/if}
		</div>
		<div class="shrink-0">{@render control()}</div>
	</div>
{/snippet}

{#snippet toggle(key: SettingKey, label: string, hint = '')}
	{#snippet control()}<Switch {label} checked={s[key] as boolean} onCheckedChange={(v) => settings.set(key, v as never)} />{/snippet}
	{@render row(label, hint, control)}
{/snippet}

<UiDialog bind:open={settingsDialog.open} bare class="flex h-[min(640px,88vh)] w-[min(820px,94vw)] overflow-hidden">
						<nav class="flex w-52 shrink-0 flex-col gap-0.5 border-r border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950/40">
							<Dialog.Title class="px-2 pt-1 pb-3 font-serif text-lg">Settings</Dialog.Title>
							{#each visible as sec (sec.id)}
								<button
									class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-stone-200/60 data-[active]:bg-stone-200 dark:hover:bg-stone-800/60 dark:data-[active]:bg-stone-800"
									data-active={settingsDialog.section === sec.id || undefined}
									onclick={() => (settingsDialog.section = sec.id)}
								>
									<span class="{sec.icon} size-4 text-stone-500"></span>{sec.label}
								</button>
							{/each}
							<button class="mt-auto px-2 py-1 text-left text-xs text-muted hover:text-red-600 dark:hover:text-red-400" onclick={async () => (await prompts.confirm('Reset every setting to its default?', { confirmLabel: 'Reset', danger: true })) && settings.reset()}>Reset to defaults</button>
						</nav>

						<div class="flex min-w-0 flex-1 flex-col">
							<header class="flex h-12 shrink-0 items-center justify-between border-b border-stone-100 pr-3 pl-6 dark:border-stone-800">
								<h2 class="text-sm font-medium">{visible.find((x) => x.id === settingsDialog.section)?.label}</h2>
								<Dialog.Close class={iconButton(8, mutedIcon)} aria-label="Close"><span class="icon-[lucide--x] size-4"></span></Dialog.Close>
							</header>
							<div class="min-h-0 flex-1 overflow-y-auto px-6 py-2">

							{#if settingsDialog.section === 'general'}
								{#snippet themeCtl()}<ToggleGroup label="Appearance" value={s.theme} onValueChange={set('theme')} items={[{ value: 'system', label: 'System', icon: 'icon-[lucide--monitor]' }, { value: 'light', label: 'Light', icon: 'icon-[lucide--sun]' }, { value: 'dark', label: 'Dark', icon: 'icon-[lucide--moon]' }]} />{/snippet}
								{@render row('Appearance', `Light or dark interface and pages (${keys.toggleTheme} flips it)`, themeCtl)}
								{@render toggle('linkPreviews', 'Link previews', 'Hover a link to preview its target (figures, sections, equations, URLs)')}
								{@render toggle('citationCards', 'Citation cards', 'Hover a citation to see the reference, with online metadata')}
							{:else if settingsDialog.section === 'reading'}
								{@render toggle('tintPages', 'Tint pages by category', 'Pages take the soft color of the paper’s category (set it in the library)')}
								{#snippet strengthCtl()}<span class="flex items-center gap-2"><Slider disabled={!s.tintPages && s.pageColor === 'white'} label="Tint strength" value={s.paperStrength} onValueChange={set('paperStrength')} /><span class="w-9 text-right text-xs text-muted tabular-nums">{Math.round(s.paperStrength * 100)}%</span></span>{/snippet}
								{@render row('Tint strength', 'How strongly pages take the paper color', strengthCtl)}
								{#snippet frameCtl()}<ToggleGroup label="Page edge" value={s.pageFrame} onValueChange={set('pageFrame')} items={[{ value: 'rounded', label: 'Rounded' }, { value: 'shadow', label: 'Shadow' }, { value: 'border', label: 'Border' }, { value: 'flat', label: 'Flat' }, { value: 'none', label: 'None' }]} />{/snippet}
								{@render row('Page edge', '', frameCtl)}
							{:else if settingsDialog.section === 'layout'}
								{#snippet zoomCtl()}<ToggleGroup label="Default zoom" value={s.zoomMode} onValueChange={set('zoomMode')} items={[{ value: 'page-width', label: 'Width', icon: 'icon-[lucide--move-horizontal]' }, { value: 'page-fit', label: 'Page', icon: 'icon-[lucide--maximize]' }, { value: 'auto', label: 'Auto', icon: 'icon-[lucide--wand-sparkles]' }]} />{/snippet}
								{@render row('Default zoom', 'When a paper opens', zoomCtl)}
								{#snippet colsCtl()}<ToggleGroup label="Pages per row" value={String(s.columns)} onValueChange={(v) => settings.set('columns', v === 'auto' ? 'auto' : (Number(v) as 1 | 2))} items={[{ value: '1', label: 'Single' }, { value: '2', label: 'Spread' }, { value: 'auto', label: 'Auto' }]} />{/snippet}
								{@render row('Pages per row', 'Spread shows two pages side by side', colsCtl)}
								{@render toggle('firstPageAlone', 'Cover page alone', 'In spreads, the first page stands alone (book layout)')}
								{#snippet scrollCtl()}<ToggleGroup label="Scrolling" value={s.scrollMode} onValueChange={set('scrollMode')} items={[{ value: 'vertical', label: 'Continuous' }, { value: 'page', label: 'Paged' }, { value: 'horizontal', label: 'Horizontal' }]} />{/snippet}
								{@render row('Scrolling', '', scrollCtl)}
								{@render toggle('smoothZoom', 'Smooth zoom', 'Animate zoom changes')}
								{@render toggle('wheelZoom', `Pinch & ${mac ? '⌘' : 'Ctrl'}-scroll zoom`)}
								{@render toggle('resumePosition', 'Resume where you left off', 'Otherwise papers open at the top')}
								{@render toggle('sidePanel', 'Open the side panel', 'Show contents, pages, figures… when a paper opens')}
								{@render toggle('progressBar', 'Reading progress bar')}
								{@render toggle('breadcrumb', 'Section breadcrumb', 'Current section next to the title')}
								{@render toggle('tocRail', 'Section rail', 'Dots on the right edge, one per section')}
								{@render toggle('minimap', 'Minimap', 'A strip of page thumbnails with find and highlight markers')}
								{#if s.minimap}
									{#snippet mmCtl()}<Select label="Minimap style" value={s.minimapVariant} onValueChange={set('minimapVariant')} items={[{ value: 'pages', label: 'Pages' }, { value: 'blocks', label: 'Blocks' }, { value: 'text', label: 'Text' }, { value: 'spine', label: 'Spine' }, { value: 'heatmap', label: 'Heatmap' }]} />{/snippet}
									{@render row('Minimap style', '', mmCtl)}
								{/if}
							{:else if settingsDialog.section === 'annotations'}
								{#snippet authorCtl()}<input {...verbatim} class="h-8 w-48 rounded-md border border-edge bg-transparent px-2 text-[13px] placeholder:text-muted" value={s.author} placeholder="Your name" onchange={(e) => settings.set('author', e.currentTarget.value.trim())} />{/snippet}
								{@render row('Author', 'Stored in each annotation (shown in other PDF readers)', authorCtl)}
								{@render toggle('annotationsVisible', 'Show annotations')}
								{@render toggle('sideNotes', 'Side notes', 'Notes in the page margin')}
								{@render toggle('lineMarkers', 'Line markers', 'Marks in the gutter next to annotated lines')}
								{@render toggle('selectionMenu', 'Menu on text selection', 'Colors, note and copy buttons over selected text')}
								{@render toggle('editOnCreate', 'Write a note right away', 'Open the note editor when you create an annotation')}
								{@render toggle('stickyTools', 'Keep the tool', 'Stay on the current tool after creating an annotation')}
								{#snippet inkCtl()}<Select label="Pen style" value={s.inkSmoothing} onValueChange={set('inkSmoothing')} items={[{ value: 'steady', label: 'Steady (exponential smoothing)' }, { value: 'smooth', label: 'Smooth (keeps sharp corners)' }, { value: 'pen', label: 'Pen (variable width)' }, { value: 'raw', label: 'Raw' }]} />{/snippet}
								{@render row('Pen style', 'How strokes are smoothed: Steady is calm, Smooth keeps sharp corners', inkCtl)}
								{@render toggle('boxFill', 'Fill boxes', 'Boxes get a translucent fill (off: outline only)')}
								<NoteEmojiSettings />
								<TextBoxFontSettings />
								{#snippet selCtl()}<ToggleGroup label="Select annotations with" value={s.selectOn} onValueChange={set('selectOn')} items={[{ value: 'click', label: 'Click' }, { value: 'dblclick', label: 'Double-click' }]} />{/snippet}
								{@render row('Select annotations with', '', selCtl)}
								{#snippet foreignCtl()}<ToggleGroup label="Other apps’ annotations" value={s.foreignAnnotations} onValueChange={set('foreignAnnotations')} items={[{ value: 'readonly', label: 'Read-only' }, { value: 'editable', label: 'Editable' }, { value: 'hidden', label: 'Hidden' }]} />{/snippet}
								{@render row('Annotations from other apps', 'Highlights made in Preview, Acrobat…', foreignCtl)}
							{:else if settingsDialog.section === 'saving'}
								{#snippet autoCtl()}<Select label="Autosave" value={String(s.autosaveSeconds)} onValueChange={(v) => settings.set('autosaveSeconds', Number(v))} items={[{ value: '0', label: `Off (${keys.save} only)` }, { value: '30', label: 'Every 30 s' }, { value: '60', label: 'Every minute' }, { value: '300', label: 'Every 5 min' }]} />{/snippet}
								{@render row('Autosave', 'Annotations are written into the PDF file', autoCtl)}
								{@render toggle('confirmUnsaved', 'Ask before closing unsaved work', 'Otherwise unsaved annotations are saved automatically on close')}
							{:else if settingsDialog.section === 'research'}
								{@render toggle('citationLookup', 'Look up references online', 'Titles, abstracts and citation counts from OpenAlex and Semantic Scholar')}
								{#snippet keyCtl()}<input {...verbatim} class="h-8 w-56 rounded-md border border-edge bg-transparent px-2 font-mono text-xs placeholder:text-muted" type="password" value={s.semanticScholarKey} placeholder="Optional" onchange={(e) => settings.set('semanticScholarKey', e.currentTarget.value.trim())} />{/snippet}
								{@render row('Semantic Scholar API key', 'Higher rate limits', keyCtl)}
							{:else if settingsDialog.section === 'library'}
								{#snippet sortCtl()}<span class="flex items-center gap-2"><Select label="Sort papers by" value={s.sortBy} onValueChange={set('sortBy')} items={sortOptions.map((o) => ({ value: o.value, label: o.label }))} /><ToggleGroup label="Order" value={s.sortDesc ? 'desc' : 'asc'} onValueChange={(v) => settings.set('sortDesc', v === 'desc')} items={[{ value: 'desc', label: '', title: 'Descending', icon: 'icon-[lucide--arrow-down-wide-narrow]' }, { value: 'asc', label: '', title: 'Ascending', icon: 'icon-[lucide--arrow-up-narrow-wide]' }]} /></span>{/snippet}
								{@render row('Sort papers by', '', sortCtl)}
								{#snippet sizeCtl()}<ToggleGroup label="Card size" value={s.cardSize} onValueChange={set('cardSize')} items={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]} />{/snippet}
								{@render row('Card size', '', sizeCtl)}
								{#snippet coverCtl()}<Select label="Cover style" value={s.coverStyle} onValueChange={set('coverStyle')} items={coverStyles} />{/snippet}
								{@render row('Cover style', '', coverCtl)}
								{#snippet samplesCtl()}
									<span class="flex items-center gap-2">
										{#if starter.running}<span class="text-xs text-muted tabular-nums">Adding {starter.done}/{starter.total || '…'}</span>
										{:else}
											<button class={button('secondary')} onclick={() => downloadStarter()}>{hasStarter() ? 'Add missing' : 'Add'}</button>
											{#if hasStarter()}<button class={button('destructive-soft')} onclick={removeExamples}>Remove</button>{/if}
										{/if}
									</span>
								{/snippet}
								{@render row('Example papers', starter.error ?? 'Annotated papers to explore the app (tagged #demo)', samplesCtl)}
								{#snippet locCtl()}<button class={button('secondary')} onclick={() => library.choose()}>Change…</button>{/snippet}
								{@render row('Library folder', library.name, locCtl)}
							{:else if settingsDialog.section === 'hooks'}
								{#snippet hookCtl()}<Select label="Hook notifications" value={s.hookToasts} onValueChange={set('hookToasts')} items={[{ value: 'errors', label: 'Failures only' }, { value: 'all', label: 'Every run' }, { value: 'off', label: 'Never' }]} />{/snippet}
								{@render row('Notifications', 'When a hook script runs', hookCtl)}
								<p class="mt-4 text-xs leading-relaxed text-muted">
									Put executable scripts in <code>.xivly/hooks/</code>, named after an event: <code>paper-added</code>, <code>paper-saved</code>, <code>paper-updated</code>, <code>paper-removed</code>. They run in the paper's folder with <code>paper.json</code> on stdin and <code>XIVLY_*</code> variables. See <code>paper-added.sample</code>.
								</p>
								{#if platform.reveal}
									<button class={button('secondary', 'mt-3')} onclick={() => platform.reveal?.('.xivly/hooks')}>Show hooks folder</button>
								{/if}
							{:else}
								{#each shortcuts as group (group.title)}
									<h3 class="mt-2 mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{group.title}</h3>
									{#each group.items as it (it.label)}
										<div class="flex items-center justify-between py-1 text-[13px]"><span>{it.label}</span><span class="flex gap-1">{#each it.keys as k (k)}<Kbd>{k}</Kbd>{/each}</span></div>
									{/each}
								{/each}
								<p class="mt-3 text-xs text-muted">Press <Kbd>?</Kbd> anywhere for every shortcut, reading and annotation keys included.</p>
							{/if}
							</div>
						</div>
</UiDialog>
