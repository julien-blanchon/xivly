<!--
	New category (or edit one): a color and a name. The swatch steps through the
	palette colors not used yet; the palette button opens the system color picker.
-->
<script lang="ts" module>
	export const categoryDialog = $state({ open: false, id: null as string | null });
	/** Open for a new category, or to edit `id`. */
	export const showCategoryDialog = (id: string | null = null) => Object.assign(categoryDialog, { open: true, id });
</script>

<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { paperColors } from 'svelte-pdf-mini';
	import { untrack } from 'svelte';
	import { categoryColor, library } from '#lib/library.svelte.js';
	import type { CategoryColor } from '#lib/types.js';
	import { button, iconButton, mutedIcon } from '#lib/ui/button.js';
	import { cn } from '#lib/ui/cn.js';
	import UiDialog from '#lib/ui/Dialog.svelte';
	import Tip from '#lib/ui/Tip.svelte';
	import { toast } from './Toasts.svelte';
	import { verbatim } from '#lib/ui/verbatim.js';

	const editing = $derived(categoryDialog.id ? library.category(categoryDialog.id) : undefined);
	let name = $state('');
	let color = $state<CategoryColor>('sage');
	let picker = $state<HTMLInputElement>();

	/** Palette colors no category uses yet (all of them once every one is taken). */
	const presets = $derived.by(() => {
		const used = new Set(library.categories.filter((c) => c.id !== categoryDialog.id).map((c) => c.color));
		const free = paperColors.filter((p) => !used.has(p.name as CategoryColor));
		return (free.length ? free : paperColors).map((p) => p.name as CategoryColor);
	});
	const custom = $derived(!paperColors.some((p) => p.name === color));
	const label = (c: CategoryColor) => (c.startsWith('#') ? 'Custom color' : c[0].toUpperCase() + c.slice(1));

	// Fresh values each time it opens.
	$effect(() => {
		if (!categoryDialog.open) return;
		untrack(() => {
			name = editing?.name ?? '';
			color = editing?.color ?? presets[0];
		});
	});

	function nextPreset() {
		const i = presets.indexOf(color);
		color = presets[(i + 1) % presets.length];
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const value = name.trim();
		if (!value) return;
		try {
			if (editing) await library.editCategory(editing.id, { name: value, color });
			else library.view = { kind: 'category', id: await library.addCategory(value, color) };
			categoryDialog.open = false;
		} catch (err) {
			toast(String(err), 'error');
		}
	}
</script>

<UiDialog bind:open={categoryDialog.open} bare form onsubmit={submit} class="w-[min(400px,92vw)] p-5">
	<Dialog.Title class="font-serif text-lg">{editing ? 'Edit category' : 'New category'}</Dialog.Title>
	<div class="mt-4 flex items-center gap-2">
		<Tip label="{label(color)} (click for another)">
			{#snippet child({ props })}
				<button {...props} type="button" aria-label="Color: {label(color)}" onclick={nextPreset} class={iconButton(8, 'rounded-lg bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700')}>
					<span class="swatch size-4 rounded-full" style:--swatch={categoryColor(color).accent}></span>
				</button>
			{/snippet}
		</Tip>
		<Tip label="Pick any color">
			{#snippet child({ props })}
				<button {...props} type="button" aria-label="Pick any color" onclick={() => picker?.click()} class={iconButton(8, cn('rounded-lg', custom ? 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100' : mutedIcon))}>
					<span class="icon-[lucide--pipette] size-4"></span>
				</button>
			{/snippet}
		</Tip>
		<!-- The system color picker, opened by the button above (not nested in it). -->
		<input bind:this={picker} type="color" tabindex="-1" aria-hidden="true" class="pointer-events-none absolute size-0 opacity-0" value={categoryColor(color).accent} oninput={(e) => (color = e.currentTarget.value as CategoryColor)} />
		<!-- svelte-ignore a11y_autofocus -->
		<input bind:value={name} {...verbatim} autofocus placeholder="Name, e.g. Robotics" aria-label="Name" class="h-8 min-w-0 flex-1 rounded-lg bg-stone-100 px-2.5 text-[13px] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 dark:bg-stone-800" />
	</div>
	<div class="mt-5 flex justify-end gap-2">
		<Dialog.Close type="button" class={button('secondary')}>Cancel</Dialog.Close>
		<button type="submit" class={button('primary')} disabled={!name.trim()}>{editing ? 'Save' : 'Create'}</button>
	</div>
</UiDialog>
