// Chrome extension (Manifest V3): `bun run build:extension`, after the app's
// own build (`XIVLY_EXTENSION=1 vite build` -> build-extension/).
//
// Turns build-extension/ into an unpacked extension (load it at
// chrome://extensions, "Load unpacked"), and zips it for the Chrome Web Store
// and the GitHub release: dist/Xivly_<version>_chrome.zip.
//   - index.html's inline SvelteKit bootstrap moves to boot.js: extension
//     pages only run scripts from the package (no inline script, no hashes)
//   - the service worker (src/lib/extension/background.ts) and the content
//     script of arXiv abstract pages (content.ts) are bundled
//   - icons from src-tauri/icons/icon.svg, manifest.json from package.json
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const out = 'build-extension';
const dev = process.argv.includes('--dev');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const fail = (msg: string) => {
	console.error(msg);
	process.exit(1);
};
if (!statSync(join(out, 'index.html'), { throwIfNoEntry: false })) fail(`No ${out}/index.html: run \`bun run build:extension\`.`);

// ── index.html: no inline script ────────────────────────────────────────────
const html = readFileSync(join(out, 'index.html'), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (inline.length !== 1) fail(`Expected SvelteKit's one inline bootstrap script in index.html, found ${inline.length}.`);
// A classic script, like the inline one: it reads document.currentScript.
writeFileSync(join(out, 'boot.js'), inline[0][1].trim() + '\n');
const page = html.replace(inline[0][0], '<script src="/boot.js"></script>');
if (/<script(?![^>]*\ssrc=)[^>]*>/.test(page) || /\son[a-z]+=/i.test(page)) fail('index.html still has inline script.');
writeFileSync(join(out, 'index.html'), page);

// ── Service worker ──────────────────────────────────────────────────────────
const sw = await Bun.build({ entrypoints: ['src/lib/extension/background.ts'], outdir: out, naming: 'background.js', target: 'browser', format: 'esm', minify: true, define: { __XIVLY_EXTENSION_DEV__: String(dev) } });
if (!sw.success) fail(sw.logs.join('\n'));

// ── Content script (arXiv abstract pages): a classic script, not a module ───
const cs = await Bun.build({ entrypoints: ['src/lib/extension/content.ts'], outdir: out, naming: 'content.js', target: 'browser', format: 'iife', minify: true });
if (!cs.success) fail(cs.logs.join('\n'));

// ── Icons ───────────────────────────────────────────────────────────────────
const sizes = [16, 32, 48, 128];
const icons = Bun.spawnSync(['bun', 'x', 'tauri', 'icon', 'src-tauri/icons/icon.svg', '--png', sizes.join(','), '--output', join(out, 'icons')], { stdout: 'ignore', stderr: 'inherit' });
if (!icons.success) fail('Icon generation failed.');
const iconSet = Object.fromEntries(sizes.map((s) => [s, `icons/${s}x${s}.png`]));

// ── manifest.json ───────────────────────────────────────────────────────────
// Chrome versions are numbers only: a prerelease (0.4.0-rc.1) shows its full
// version as `version_name` (the Web Store only gets stable releases).
const [version, prerelease] = (pkg.version as string).split('-');
const manifest = {
	manifest_version: 3,
	name: 'Xivly',
	description: 'Read, annotate and organize research papers. Your library is a folder of plain files: PDFs with their annotations, and paper.json.',
	version,
	...(prerelease && { version_name: pkg.version }),
	// pdf.js 6 needs current engines (see the check in +layout.svelte): Map.getOrInsertComputed is the newest.
	minimum_chrome_version: '145',
	homepage_url: 'https://github.com/julien-blanchon/xivly',
	icons: iconSet,
	action: { default_title: 'Xivly', default_icon: iconSet },
	background: { service_worker: 'background.js', type: 'module' },
	// contextMenus: "Open in Xivly". activeTab: the URL of the tab whose toolbar menu was used.
	// storage: the "Open arXiv PDFs in Xivly" setting, for the service worker; the PDFs it
	// just opened in Xivly (session); in dev builds, the tabs to reopen after a live reload.
	// None of these warns at install.
	permissions: ['contextMenus', 'activeTab', 'storage'],
	// arXiv: the "Open in Xivly" link on abstract pages, and the URL of its PDF tabs (opened in
	// Xivly instead). The one install warning: "Read and change your data on all arxiv.org sites".
	host_permissions: ['*://*.arxiv.org/*'],
	content_scripts: [{ matches: ['*://*.arxiv.org/abs/*'], js: ['content.js'], run_at: 'document_end' }],
	// Downloading a PDF from a site without CORS, asked for that site when first needed.
	optional_host_permissions: ['https://*/*', 'http://*/*'],
	// The desktop CSP (src-tauri/tauri.conf.json), with any download source: PDFs come from anywhere.
	content_security_policy: {
		extension_pages:
			"default-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data: blob:; worker-src 'self'; connect-src 'self' blob: data: https: http:"
	}
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Chrome refuses to load an extension whose manifest names a missing file.
const named = [...Object.values(iconSet), manifest.background.service_worker, ...manifest.content_scripts.flatMap((c) => c.js), 'index.html', 'boot.js'];
const missing = named.filter((f) => !statSync(join(out, f), { throwIfNoEntry: false }));
if (missing.length) fail(`manifest.json names missing files: ${missing.join(', ')}`);
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) fail(`"${manifest.version}" is not a Chrome version (1 to 4 numbers).`);

// ── Dev build (bun run dev:extension): no zip; dev-build.json, written last, tells
// open pages what changed (src/lib/extension/app.svelte.ts liveReload).
if (dev) {
	const hash = (files: string[]) => Bun.hash(files.map((f) => readFileSync(join(out, f), 'utf8')).join('\0')).toString(36);
	const all: string[] = [];
	const list = (dir: string) => {
		for (const name of readdirSync(join(out, dir))) {
			const path = join(dir, name);
			if (statSync(join(out, path)).isDirectory()) list(path);
			else all.push(path);
		}
	};
	list('');
	writeFileSync(join(out, 'dev-build.json'), JSON.stringify({ page: hash(all.sort()), worker: hash(['background.js', 'content.js', 'manifest.json']) }));
	console.log(`${out}/ (unpacked, live reload)`);
	process.exit(0);
}

// ── Zip ─────────────────────────────────────────────────────────────────────
const files: Record<string, Uint8Array> = {};
const walk = (dir: string) => {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path);
		else files[relative(out, path)] = readFileSync(path);
	}
};
walk(out);
const reserved = Object.keys(files).filter((f) => f.split('/').some((p) => p.startsWith('_')));
if (reserved.length) fail(`Chrome reserves names starting with "_": ${reserved.join(', ')}`);
const zip = `dist/Xivly_${pkg.version}_chrome.zip`;
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
writeFileSync(zip, zipSync(files, { level: 9 }));
console.log(`${out}/ (unpacked) and ${zip}: ${Object.keys(files).length} files, ${(statSync(zip).size / 1e6).toFixed(1)} MB`);
