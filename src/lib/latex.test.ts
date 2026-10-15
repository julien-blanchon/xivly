import { describe, expect, it } from 'vitest';
import { latexToUnicode as t } from './latex';

describe('latexToUnicode', () => {
	it('leaves plain titles alone', () => {
		for (const s of [
			'Attention Is All You Need',
			'DINOv2: Learning Robust Visual Features without Supervision',
			'snake_case and x^2 outside math',
			'Earn $5 and $10',
			'Between $5-$10 per hour',
			'Training on ~1B tokens',
			"It's a model's world",
			'GPT-4 Technical Report',
			''
		])
			expect(t(s)).toBe(s);
	});

	it('Greek letters', () => {
		expect(t('$\\alpha$-divergence')).toBe('α-divergence');
		expect(t('$\\epsilon$-greedy')).toBe('ε-greedy');
		expect(t('$\\Delta$-Net and $\\varphi$')).toBe('Δ-Net and φ');
		expect(t('\\alpha outside math')).toBe('α outside math');
	});

	it('symbols, relations, arrows', () => {
		expect(t('$\\leq$')).toBe('≤');
		expect(t('Bounds for $k \\geq 2$')).toBe('Bounds for k ≥ 2');
		expect(t('$x \\in \\mathbb{R}^n$')).toBe('x ∈ ℝⁿ');
		expect(t('$\\infty$-width')).toBe('∞-width');
		expect(t('$A \\to B$, $a \\approx b$, $a \\times b$, $a \\cdot b$')).toBe('A → B, a ≈ b, a × b, a · b');
		expect(t('$\\sum_{i=1}^n x_i$')).toBe('∑ᵢ₌₁ⁿ xᵢ');
		expect(t('$\\not=$ and $\\not\\in$')).toBe('≠ and ∉');
	});

	it('super- and subscripts', () => {
		expect(t('$O(n^2)$ attention')).toBe('O(n²) attention');
		expect(t('$10^{-3}$')).toBe('10⁻³');
		expect(t('$x_i$')).toBe('xᵢ');
		expect(t('$x^{ab}$')).toBe('xᵃᵇ');
		expect(t('$x^{(t)}$ and $W^\\top$')).toBe('x⁽ᵗ⁾ and Wᵀ');
		expect(t("$f'(x)$")).toBe('f′(x)');
		// No subscript g, q: kept readable.
		expect(t('$\\text{BERT}_{\\text{large}}$')).toBe('BERT_large');
		expect(t('$x^q$')).toBe('x^q');
		expect(t('$\\mathbb{R}^{n \\times m}$')).toBe('ℝ^(n × m)');
		expect(t('the 1\\textsuperscript{st}')).toBe('the 1ˢᵗ');
	});

	it('fonts', () => {
		expect(t('Scaling $\\mathcal{L}$')).toBe('Scaling ℒ');
		expect(t('$\\mathcal{O}(n \\log n)$')).toBe('𝒪(n log n)');
		expect(t('$\\mathbb{R}$, $\\mathbb{E}$, $\\mathbb{1}$')).toBe('ℝ, 𝔼, 𝟙');
		expect(t('$\\mathbf{x}$ and $\\mathrm{d}x$')).toBe('x and dx');
		expect(t('\\textit{foo} \\textbf{bar} \\emph{x} \\texttt{y}')).toBe('foo bar x y');
		expect(t('$\\operatorname{softmax}(x)$')).toBe('softmax(x)');
		expect(t('{\\em Emphasis} and {\\bf bold}')).toBe('Emphasis and bold');
		expect(t('$\\mathfrak{g}$')).toBe('𝔤');
	});

	it('roots and fractions', () => {
		expect(t('$\\sqrt{n}$')).toBe('√n');
		expect(t('$\\sqrt{xy}$')).toBe('√(xy)');
		expect(t('$\\sqrt{d_k}$')).toBe('√dₖ');
		expect(t('$\\sqrt[3]{x}$')).toBe('∛x');
		expect(t('$\\frac{1}{2}$')).toBe('1/2');
		expect(t('$\\frac{a+b}{\\sqrt{d}}$')).toBe('(a+b)/√d');
		expect(t('$O(\\frac{1}{\\epsilon^2})$')).toBe('O(1/ε²)');
	});

	it('accents', () => {
		expect(t('G\\"{o}del')).toBe('Gödel');
		expect(t('Erd\\H{o}s and Erd\\"os')).toBe('Erdős and Erdös');
		expect(t("Poincar\\'e, \\`a la, \\^{e}tre")).toBe('Poincaré, à la, être');
		expect(t('Ma\\~nana, Gar\\c{c}on, \\v{S}koda')).toBe('Mañana, Garçon, Škoda');
		expect(t("{\\'\\i}ndice")).toBe('índice');
		expect(t('{\\"U}ber')).toBe('Über');
		expect(t('$\\hat{y}$ and $\\vec{v}$ and $\\widehat{xy}$')).toBe('ŷ and v⃗ and xy');
		expect(t('Stra{\\ss}e, {\\o}re')).toBe('Straße, øre');
	});

	it('text punctuation and escapes', () => {
		expect(t('Pages 1--10')).toBe('Pages 1–10');
		expect(t('Models---and more')).toBe('Models—and more');
		expect(t('Fig.~3')).toBe('Fig. 3');
		expect(t('R\\&D: 50\\% off \\$5 my\\_var \\#1')).toBe('R&D: 50% off $5 my_var #1');
		expect(t('``Quoted\'\'')).toBe('“Quoted”');
		expect(t('{BERT}: Pre-training of Deep {Bidirectional} Transformers')).toBe('BERT: Pre-training of Deep Bidirectional Transformers');
		expect(t('stray } brace {')).toBe('stray brace');
	});

	it('math delimiters', () => {
		expect(t('$k$-NN')).toBe('k-NN');
		expect(t('$$x^2$$ display')).toBe('x² display');
		expect(t('\\(x_1\\) and \\[y^2\\]')).toBe('x₁ and y²');
		expect(t('Earn $5 and $\\alpha$')).toBe('Earn $5 and α');
		expect(t('between $5 and $10 per $x$')).toBe('between $5 and $10 per x');
		expect(t('unclosed $\\alpha')).toBe('unclosed $α');
		expect(t('$O(n-1)$')).toBe('O(n−1)');
	});

	it('spacing and sizing commands', () => {
		expect(t('$O(n\\,\\log n)$')).toBe('O(n log n)');
		expect(t('$\\left(\\frac{a}{b}\\right)$')).toBe('(a/b)');
		expect(t('$\\left.x\\right|$')).toBe('x|');
		expect(t('$\\|x\\|_2$')).toBe('‖x‖₂');
		expect(t('A Title\\thanks{Funded by X}')).toBe('A Title');
		expect(t('\\href{https://x.y}{Site} and \\url{a.b}')).toBe('Site and a.b');
	});

	it('unknown macros keep their name', () => {
		expect(t('\\ours: a model')).toBe('ours: a model');
	});

	it('is total on malformed input', () => {
		for (const s of ['\\', '{', '}', '$', '$$', '^', '_', '\\frac', '\\sqrt[', '$x^$', '\\"', '\\left', '$\\mathbb{$'])
			expect(typeof t(s)).toBe('string');
	});
});
