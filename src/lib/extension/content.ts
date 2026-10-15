/// <reference types="chrome" />
// Chrome extension content script on arXiv abstract pages (bundled on its own
// by scripts/build-extension.ts): an "Open in Xivly" link next to "View PDF".
// It reads nothing from the page; the service worker opens the page's URL
// (the message's sender) in Xivly, as the context menu does (./background.ts).
import type { ExtensionMessage } from './messages';

if (!document.getElementById('xivly-open')) {
	const link = Object.assign(document.createElement('a'), { id: 'xivly-open', href: location.href, textContent: 'Open in Xivly', title: 'Add this paper to your Xivly library and read it' });
	const open = (e: MouseEvent) => {
		if (e.button > 1) return;
		e.preventDefault();
		const message: ExtensionMessage = { type: 'open-page', background: e.button === 1 || e.metaKey || e.ctrlKey };
		// Once the extension was updated or reloaded, only a reload of the page reconnects it.
		chrome.runtime.sendMessage(message).catch(() => chrome.runtime?.id || location.reload());
	};
	link.addEventListener('click', open);
	link.addEventListener('auxclick', open);
	// "Access Paper" (View PDF, HTML, TeX Source): one more of arXiv's own buttons.
	const list = document.querySelector('.extra-services .full-text ul');
	if (list) {
		link.className = 'abs-button';
		const item = document.createElement('li');
		item.append(link);
		const pdf = list.querySelector('a.download-pdf')?.closest('li');
		if (pdf) pdf.after(item);
		else list.append(item);
	} else {
		// Another layout: a plain link under the title.
		const title = document.querySelector('h1.title, h1');
		const line = Object.assign(document.createElement('p'), { style: 'margin: 0.5em 0' });
		line.append(link);
		if (title) title.after(line);
		else document.body.prepend(line);
	}
}
