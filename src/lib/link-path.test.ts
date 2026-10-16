import { describe, expect, it } from 'vitest';
import { linkFromPath } from './link-path';

describe('linkFromPath', () => {
	it.each([
		['/1706.03762', '1706.03762'],
		['/1706.03762v7', '1706.03762v7'],
		['/arXiv:1706.03762', 'arXiv:1706.03762'],
		['/hep-th/9901001', 'hep-th/9901001'],
		['/abs/1706.03762', '1706.03762'],
		['/pdf/1706.03762v7', '1706.03762v7'],
		['/https://arxiv.org/abs/1706.03762', 'https://arxiv.org/abs/1706.03762'],
		['/https:/arxiv.org/abs/1706.03762', 'https://arxiv.org/abs/1706.03762'],
		['/arxiv.org/abs/1706.03762', 'arxiv.org/abs/1706.03762'],
		['/https://huggingface.co/papers/1706.03762', 'https://huggingface.co/papers/1706.03762'],
		['/http://example.com/paper.pdf', 'http://example.com/paper.pdf'],
		['/example.com/papers/paper.pdf', 'https://example.com/papers/paper.pdf']
	])('%s', (path, link) => expect(linkFromPath(path)).toBe(link));
	it('keeps the link’s query', () => {
		expect(linkFromPath('/https://example.com/get', '?id=3&format=pdf')).toBe('https://example.com/get?id=3&format=pdf');
	});
	it('rejects anything else', () => {
		expect(linkFromPath('/')).toBeNull();
		expect(linkFromPath('/settings')).toBeNull();
		expect(linkFromPath('/abs/nope')).toBeNull();
		expect(linkFromPath('/ftp://example.com/paper.pdf')).toBeNull();
		expect(linkFromPath('/example.com')).toBeNull();
	});
});
