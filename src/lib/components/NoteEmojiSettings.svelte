<!-- Settings › Annotations: the 8 note emoji (keys 1–8 with the note tool). A slot opens a picker: a grid of faces and symbols, or any emoji typed or pasted. -->
<script lang="ts">
	import { button } from '#lib/ui/button.js';
	import { Popover } from 'bits-ui';
	import { scale } from 'svelte/transition';
	import { defaultNoteEmojis, isSingleEmoji } from 'svelte-pdf-mini';
	import { noteEmojiChoices, noteEmojiLabel } from '#lib/pdf/note-emoji.js';
	import { settings } from '#lib/settings.svelte.js';
	import { verbatim } from '#lib/ui/verbatim.js';

	const emojis = $derived(settings.values.noteEmojis);
	const isDefault = $derived(emojis.join() === defaultNoteEmojis.join());
	/** The slot whose picker is open. */
	let openSlot = $state<number | null>(null);
	let typed = $state('');
	const typedEmoji = $derived(typed.trim());
	const typedValid = $derived(isSingleEmoji(typedEmoji));

	function choose(slot: number, emoji: string) {
		settings.set('noteEmojis', emojis.map((e, i) => (i === slot ? emoji : e)));
		openSlot = null;
	}
</script>

<div class="border-b border-stone-100 py-3 last:border-0 dark:border-stone-800">
	<div class="flex items-center justify-between gap-6">
		<div class="min-w-0">
			<p class="text-[13px] font-medium">Note emoji</p>
			<p class="text-xs text-stone-500">With the note tool, keys 1–8 pick a note’s emoji instead of a color</p>
		</div>
		{#if !isDefault}<button class={button('ghost', 'h-7 px-2.5 text-xs')} onclick={() => settings.set('noteEmojis', defaultNoteEmojis)}>Reset to defaults</button>{/if}
	</div>
	<div class="mt-2.5 flex gap-1.5" role="group" aria-label="Note emoji">
		{#each emojis as emoji, i (i)}
			<Popover.Root
				open={openSlot === i}
				onOpenChange={(o) => {
					openSlot = o ? i : null;
					typed = '';
				}}
			>
				<Popover.Trigger
					aria-label="Key {i + 1}: {emoji} {noteEmojiLabel(emoji)}"
					title="{noteEmojiLabel(emoji)} ({i + 1})"
					class="flex h-12 w-10 flex-col items-center justify-center gap-0.5 rounded-lg border border-stone-200 outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-blue-500/60 data-[state=open]:border-stone-400 data-[state=open]:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800 dark:data-[state=open]:border-stone-500 dark:data-[state=open]:bg-stone-800"
				>
					<span class="font-emoji text-xl leading-none">{emoji}</span>
					<span class="text-[10px] text-stone-400 tabular-nums">{i + 1}</span>
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content sideOffset={6} forceMount>
						{#snippet child({ wrapperProps, props, open })}
							{#if open}
								<div {...wrapperProps}>
									<div {...props} transition:scale={{ start: 0.96, duration: 110 }} class="z-(--z-menu) w-80 rounded-xl border border-stone-200 bg-white p-2 text-[13px] shadow-xl dark:border-stone-700 dark:bg-stone-900">
										<p class="px-1 pb-1.5 text-xs text-stone-500">Emoji for key {i + 1}</p>
										<div class="grid grid-cols-10 gap-0.5">
											{#each noteEmojiChoices as choice (choice)}
												<button
													class="grid size-7 place-items-center rounded-md font-emoji text-lg leading-none outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-blue-500/60 data-[active]:bg-stone-200 dark:hover:bg-stone-800 dark:data-[active]:bg-stone-700"
													data-active={choice === emoji || undefined}
													aria-label={choice}
													onclick={() => choose(i, choice)}>{choice}</button
												>
											{/each}
										</div>
										<form
											class="mt-2 flex items-center gap-1.5 border-t border-stone-100 pt-2 dark:border-stone-800"
											onsubmit={(e) => {
												e.preventDefault();
												if (typedValid) choose(i, typedEmoji);
											}}
										>
											<input
												{...verbatim}
												class="h-8 min-w-0 flex-1 rounded-md border border-stone-300 bg-transparent px-2 font-emoji text-[13px] outline-none placeholder:font-sans focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:border-stone-700"
												bind:value={typed}
												placeholder="Type or paste any emoji"
												aria-label="Any emoji"
												aria-invalid={typedEmoji !== '' && !typedValid}
											/>
											<button class={button('secondary', 'h-8 px-3')} disabled={!typedValid}>Use</button>
										</form>
										{#if typedEmoji && !typedValid}<p class="px-1 pt-1 text-xs text-red-600 dark:text-red-400">One emoji only</p>{/if}
									</div>
								</div>
							{/if}
						{/snippet}
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		{/each}
	</div>
</div>
