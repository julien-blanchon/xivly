<script lang="ts">
	import { button } from '#lib/ui/button.js';
	import { Dialog } from 'bits-ui';
	import UiDialog from './Dialog.svelte';
	import { prompts } from './prompt.svelte';
	import { verbatim } from '#lib/ui/verbatim.js';

	// Starts from each prompt's value; the field edits it.
	let text = $derived(prompts.current?.value ?? '');
	const submit = () => prompts.close(prompts.current?.choices ? prompts.current.choices.at(-1)!.value : prompts.current?.value !== undefined ? text.trim() || null : true);
</script>

<UiDialog open={!!prompts.current} onOpenChange={(o) => !o && prompts.close(null)} layer="alert" bare form onsubmit={(e) => (e.preventDefault(), submit())} class="w-[min(420px,92vw)] p-5">
	{#if prompts.current}
		{@const p = prompts.current}
		<Dialog.Title class="font-serif text-lg">{p.title}</Dialog.Title>
		{#if p.message}<Dialog.Description class="mt-1 text-sm text-muted">{p.message}</Dialog.Description>{/if}
		{#if p.value !== undefined}
			<!-- svelte-ignore a11y_autofocus -->
			<input bind:value={text} {...verbatim} autofocus placeholder={p.placeholder} class="mt-3 h-8 w-full rounded-md border border-edge bg-transparent px-2 text-[13px] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400" />
		{/if}
		<div class="mt-4 flex justify-end gap-2 text-sm">
			<button type="button" class={button('secondary')} onclick={() => prompts.close(null)}>Cancel</button>
			{#if p.choices}
				{#each p.choices as c, i (c.value)}
					{#if i === p.choices.length - 1}<button type="submit" class={button('primary')}>{c.label}</button>{:else}<button type="button" class={button('secondary')} onclick={() => prompts.close(c.value)}>{c.label}</button>{/if}
				{/each}
			{:else}
				<button type="submit" class={button(p.danger ? 'destructive' : 'primary')}>{p.confirmLabel}</button>
			{/if}
		</div>
	{/if}
</UiDialog>
