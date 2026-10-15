// App settings: one typed object, persisted per platform (Tauri store on
// desktop, localStorage on web) and live-synced across windows / tabs.
import { defaultNoteEmojis, FREETEXT_FONT_FAMILIES, isSingleEmoji, type FreeTextFontFamily, type InkSmoothing, type MinimapVariant, type ScrollMode, type ZoomMode } from 'svelte-pdf-mini';
import { platform } from './platform';

/** Days covered by each "Recent" window. */
export const recentWindows = { day: 1, week: 7, month: 30 } as const;
export type RecentWindow = keyof typeof recentWindows;

export type PageFrame = 'rounded' | 'shadow' | 'border' | 'flat' | 'none';

export type CoverStyle = 'book' | 'stack' | 'flat' | 'page';
export const coverStyles: { value: CoverStyle; label: string }[] = [
	{ value: 'book', label: 'Book' },
	{ value: 'stack', label: 'Paper stack' },
	{ value: 'flat', label: 'Flat' },
	{ value: 'page', label: 'First page' }
];

export type SortKey = 'added' | 'opened' | 'published' | 'title';

const defaults = {
	// General
	theme: 'system' as 'system' | 'light' | 'dark',

	// Reading: page look (see svelte-pdf-mini page-themes)
	/** Tint pages with the paper's category color (else plain white pages). */
	tintPages: true,
	/** Page color when not tinted by category: 'white', 'warm' or a palette name. */
	pageColor: 'white',
	paperStrength: 0.2,
	pageFrame: 'rounded' as PageFrame,

	// Reading: layout & zoom
	zoomMode: 'page-width' as Exclude<ZoomMode, 'manual'>,
	columns: 1 as 1 | 2 | 'auto',
	scrollMode: 'vertical' as ScrollMode,
	firstPageAlone: false,
	smoothZoom: true,
	wheelZoom: true,
	/** Reopen papers where you left off (else at the top). */
	resumePosition: true,

	// Reading: panels & aids
	sidePanel: false,
	minimap: false,
	minimapVariant: 'pages' as MinimapVariant,
	tocRail: false,
	progressBar: true,
	breadcrumb: true,
	linkPreviews: true,
	citationCards: true,

	// Annotations
	author: '',
	annotationsVisible: true,
	sideNotes: false,
	lineMarkers: true,
	stickyTools: false,
	/** Pen stroke smoothing (svelte-pdf-mini `smoothStroke`). */
	inkSmoothing: 'steady' as InkSmoothing,
	/** Boxes are filled (translucent) or outlined. */
	boxFill: true,
	selectOn: 'dblclick' as 'click' | 'dblclick',
	/** Color / note / copy menu over a text selection. */
	selectionMenu: false,
	editOnCreate: true,
	foreignAnnotations: 'readonly' as 'editable' | 'readonly' | 'hidden',
	/** The 8 emoji a note can show, picked with keys 1–8 while the note tool is active. */
	noteEmojis: defaultNoteEmojis as readonly string[],
	/** Font of new text boxes (existing ones keep theirs). */
	freetextFont: 'Handwritten' as FreeTextFontFamily,

	// Saving
	/** Seconds between autosaves of unsaved annotations; 0 = only on ⌘S / close. */
	autosaveSeconds: 60,
	confirmUnsaved: true,

	// Research
	citationLookup: true,
	semanticScholarKey: '',

	// Library
	cardSize: 'medium' as 'small' | 'medium' | 'large',
	/** The example library was offered (first start). */
	starterOffered: false,
	/** How paper cards look in the library. */
	coverStyle: 'book' as CoverStyle,
	sortBy: 'added' as SortKey,
	/** Newest / Z first (desc) or oldest / A first (asc). */
	sortDesc: true,
	/** Show every paper, only unread or only read ones. */
	readFilter: 'all' as 'all' | 'unread' | 'read',
	/** What "Recent" covers: papers opened within the last day, week or month. */
	recentWindow: 'week' as RecentWindow,

	// Desktop
	hookToasts: 'errors' as 'all' | 'errors' | 'off'
};

export type Settings = typeof defaults;
export type SettingKey = keyof Settings;

const STORAGE_KEY = 'xivly:settings';
const EVENT = 'xivly://settings';

/**
 * Changed keys only: a value, or `undefined` once back to its default (removed
 * from storage). Two windows changing different settings never undo each other.
 */
export type Changes = Partial<Record<SettingKey, unknown>>;

interface Backend {
	load(): Promise<Partial<Settings>>;
	/** Write these keys; `null` changes clears everything (reset). */
	save(changes: Changes | null): Promise<void>;
	/** Changes made by other windows / tabs (`null`: reset). */
	watch(apply: (changes: Changes | null) => void): void;
}

/** Stored overrides after `changes` (exported for tests). */
export function applyChanges(stored: Changes, changes: Changes | null): Changes {
	if (!changes) return {};
	const next = { ...stored };
	for (const [k, v] of Object.entries(changes)) {
		if (v === undefined) delete next[k as SettingKey];
		else next[k as SettingKey] = v;
	}
	return next;
}

const webBackend: Backend = {
	async load() {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		} catch {
			return {};
		}
	},
	async save(changes) {
		let stored: Changes = {};
		try {
			stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		} catch {
			// Unreadable: rewritten from these changes.
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(applyChanges(stored, changes)));
	},
	watch(apply) {
		// The other tabs get the whole stored object: apply it as a reset + changes.
		addEventListener('storage', (e) => {
			if (e.key !== STORAGE_KEY) return;
			try {
				apply(null);
				apply(e.newValue ? JSON.parse(e.newValue) : {});
			} catch {
				// Ignored: a later write fixes it.
			}
		});
	}
};

const desktopBackend = (): Backend => {
	const store = import('@tauri-apps/plugin-store').then(({ LazyStore }) => new LazyStore('settings.json'));
	const event = import('@tauri-apps/api/event');
	const self = import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().label);
	return {
		async load() {
			return Object.fromEntries(await (await store).entries()) as Partial<Settings>;
		},
		async save(changes) {
			const s = await store;
			if (!changes) await s.clear();
			for (const [k, v] of Object.entries(changes ?? {})) {
				if (v === undefined) await s.delete(k);
				else await s.set(k, v);
			}
			await s.save();
			// Tell the other windows (the store's own events are per webview); `emit`
			// reaches this one too, which must not re-apply what it already has.
			await (await event).emit(EVENT, { source: await self, changes });
		},
		watch(apply) {
			event.then(({ listen }) =>
				listen<{ source: string; changes: Changes | null }>(EVENT, async ({ payload }) => {
					if (payload.source !== (await self)) apply(payload.changes);
				})
			);
		}
	};
};

class SettingsState {
	values = $state<Settings>({ ...defaults });
	ready = $state(false);
	#backend: Backend = platform.kind === 'desktop' ? desktopBackend() : webBackend;

	async init() {
		const stored = await this.#backend.load().catch(() => ({}));
		this.values = { ...defaults, ...pick(stored) };
		this.#backend.watch((changes) => {
			if (!changes) return void (this.values = { ...defaults });
			const known = pick(changes as Partial<Settings>);
			for (const k of Object.keys(changes) as SettingKey[]) {
				if (!(k in defaults)) continue;
				// Back to its default, or a value this version accepts.
				(this.values as Record<SettingKey, unknown>)[k] = k in known ? known[k] : defaults[k];
			}
		});
		this.ready = true;
	}

	#saveTimer: ReturnType<typeof setTimeout> | undefined;
	#dirty = new Set<SettingKey>();

	/** Applies at once; written (and sent to other windows) once a drag settles. */
	set<K extends SettingKey>(key: K, value: Settings[K]) {
		this.values[key] = value;
		this.#dirty.add(key);
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => void this.flush(), 300);
	}

	/** Write what's pending now (a window closing must not drop its last change). */
	flush() {
		clearTimeout(this.#saveTimer);
		if (!this.#dirty.size) return Promise.resolve();
		const values = $state.snapshot(this.values) as Settings;
		const changes = Object.fromEntries([...this.#dirty].map((k) => [k, overrideOf(k, values[k])])) as Changes;
		this.#dirty.clear();
		return this.#backend.save(changes).catch((e) => console.warn('settings not saved', e));
	}

	reset() {
		clearTimeout(this.#saveTimer);
		this.#dirty.clear();
		this.values = { ...defaults };
		void this.#backend.save(null);
	}
}

/** Only what differs from the defaults is stored, so changed defaults reach everyone. */
export function overrideOf<K extends SettingKey>(key: K, value: Settings[K]): Settings[K] | undefined {
	const same = Array.isArray(value) ? JSON.stringify(value) === JSON.stringify(defaults[key]) : value === defaults[key];
	return same ? undefined : value;
}

/** Settings with a closed set of values: anything else falls back to the default. */
const validators: Partial<Record<string, (v: unknown) => boolean>> = {
	coverStyle: (v) => coverStyles.some((c) => c.value === v),
	recentWindow: (v) => typeof v === 'string' && v in recentWindows,
	freetextFont: (v) => FREETEXT_FONT_FAMILIES.includes(v as FreeTextFontFamily),
	noteEmojis: (v) => Array.isArray(v) && v.length === defaultNoteEmojis.length && v.every((e) => typeof e === 'string' && isSingleEmoji(e))
};

/** Known keys only (old or foreign keys in the store are ignored). */
export function pick(stored: Partial<Settings>): Partial<Settings> {
	const known = Object.entries(stored).filter(([k]) => k in defaults);
	// Choices that no longer exist fall back to the default.
	const valid = ([k, v]: [string, unknown]) => validators[k]?.(v) ?? true;
	return Object.fromEntries(known.filter(valid)) as Partial<Settings>;
}

export const settings = new SettingsState();
