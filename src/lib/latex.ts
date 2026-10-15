// LaTeX in paper titles (arXiv metadata: "$\alpha$-divergence", "\textit{x}",
// "$O(n^2)$") as readable Unicode, for display only: stored titles stay raw.
// Conservative: titles without LaTeX come back unchanged, and `$` is math only
// when it pairs up like TeX math ("$x$"), not money ("Earn $5 and $10").

const GREEK: Record<string, string> = {
	alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
	theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', varkappa: 'ϰ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
	omicron: 'ο', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ',
	upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
	Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
	Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
};

const SYMBOLS: Record<string, string> = {
	// Relations
	leq: '≤', le: '≤', leqslant: '⩽', geq: '≥', ge: '≥', geqslant: '⩾', neq: '≠', ne: '≠', approx: '≈',
	sim: '∼', simeq: '≃', cong: '≅', equiv: '≡', propto: '∝', ll: '≪', gg: '≫', lesssim: '≲', gtrsim: '≳',
	prec: '≺', succ: '≻', preceq: '⪯', succeq: '⪰', triangleq: '≜', coloneqq: '≔', doteq: '≐',
	in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
	perp: '⊥', parallel: '∥', mid: '∣', vdash: '⊢', models: '⊨',
	// Operators
	times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘', bullet: '•',
	oplus: '⊕', ominus: '⊖', otimes: '⊗', odot: '⊙', wedge: '∧', land: '∧', vee: '∨', lor: '∨',
	neg: '¬', lnot: '¬', cup: '∪', cap: '∩', setminus: '∖', sqcup: '⊔',
	sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', oint: '∮', bigcup: '⋃', bigcap: '⋂',
	bigoplus: '⨁', bigotimes: '⨂', bigvee: '⋁', bigwedge: '⋀',
	// Arrows
	to: '→', rightarrow: '→', leftarrow: '←', gets: '←', leftrightarrow: '↔', Rightarrow: '⇒',
	Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⟹', iff: '⟺', mapsto: '↦', uparrow: '↑',
	downarrow: '↓', longrightarrow: '⟶', longleftarrow: '⟵', hookrightarrow: '↪', rightleftharpoons: '⇌',
	// Misc
	infty: '∞', forall: '∀', exists: '∃', nexists: '∄', nabla: '∇', partial: '∂', emptyset: '∅',
	varnothing: '∅', ell: 'ℓ', hbar: 'ℏ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', wp: '℘', angle: '∠',
	top: '⊤', bot: '⊥', prime: '′', dagger: '†', ddagger: '‡', checkmark: '✓', surd: '√',
	ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
	langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', lvert: '|', rvert: '|',
	lVert: '‖', rVert: '‖', vert: '|', Vert: '‖', backslash: '\\',
	// Text
	S: '§', P: '¶', dag: '†', ddag: '‡', copyright: '©', textregistered: '®', texttrademark: '™',
	textdegree: '°', degree: '°', ss: 'ß', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ',
	aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'ı', j: 'ȷ', textendash: '–', textemdash: '—',
	textquoteleft: '‘', textquoteright: '’', textquotedblleft: '“', textquotedblright: '”',
	textasciitilde: '~', textbackslash: '\\', textunderscore: '_', textbar: '|', textbullet: '•',
	textellipsis: '…', LaTeX: 'LaTeX', TeX: 'TeX', textless: '<', textgreater: '>'
};

/** Typeset upright as their name: \log n → log n. */
const NAMED = new Set(
	'log ln lg exp sin cos tan cot sec csc sinh cosh tanh arcsin arccos arctan max min sup inf lim liminf limsup arg det dim ker deg gcd hom Pr mod bmod'.split(' ')
);
/** Content set as text, even in math (\text{BERT}). */
const TEXT_MODE = new Set(
	'text textrm textit textbf textsf texttt textup textsl textmd textnormal textsc emph mbox hbox operatorname'.split(' ')
);
/** A font change only: the content as is. */
const STYLE = new Set('mathrm mathit mathbf mathsf mathtt mathnormal boldsymbol bm pmb underline uline mathbin mathrel mathop'.split(' '));
/** Declarations and sizing that print nothing. */
const IGNORE = new Set(
	('left right middle big Big bigg Bigg bigl bigr Bigl Bigr biggl biggr Biggl Biggr bf it em rm sf tt sc sl ' +
		'tiny scriptsize footnotesize small normalsize large Large LARGE huge Huge displaystyle textstyle ' +
		'scriptstyle scriptscriptstyle limits nolimits boldmath unboldmath relax protect nobreak allowbreak ' +
		'xspace noindent centering')
		.split(' ')
);
/** Commands whose argument isn't shown. */
const DROP = new Set('thanks footnote label cite citep citet ref eqref vspace hspace phantom color'.split(' '));
const SPACE = new Set('quad qquad enspace thinspace space newline linebreak par'.split(' '));

const TEXT_ACCENTS: Record<string, string> = {
	"'": '\u0301', '`': '\u0300', '^': '\u0302', '~': '\u0303', '"': '\u0308', '=': '\u0304', '.': '\u0307',
	u: '\u0306', v: '\u030C', H: '\u030B', c: '\u0327', k: '\u0328', r: '\u030A', d: '\u0323', b: '\u0331'
};
const MATH_ACCENTS: Record<string, string> = {
	hat: '\u0302', widehat: '\u0302', tilde: '\u0303', widetilde: '\u0303', bar: '\u0304', overline: '\u0305',
	vec: '\u20D7', dot: '\u0307', ddot: '\u0308', check: '\u030C', breve: '\u0306', acute: '\u0301',
	grave: '\u0300', mathring: '\u030A'
};

const pairs = (keys: string, values: string) => {
	const v = Array.from(values);
	return Object.fromEntries(Array.from(keys).map((k, i) => [k, v[i]]));
};
const SUP: Record<string, string> = {
	...pairs('0123456789+-−=()', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾'),
	...pairs('abcdefghijklmnoprstuvwxyz', 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ'),
	...pairs('ABDEGHIJKLMNOPRTUVW', 'ᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ'),
	...pairs('αβγδεθιφχ⊤', 'ᵅᵝᵞᵟᵋᶿᶥᵠᵡᵀ'),
	'*': '*', '∗': '*', '′': '′', '†': '†', '‡': '‡'
};
const SUB: Record<string, string> = {
	...pairs('0123456789+-−=()', '₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎'),
	...pairs('aehijklmnoprstuvx', 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ'),
	...pairs('βγρφχ', 'ᵦᵧᵨᵩᵪ'),
	',': ','
};
const SCRIPT_CHARS = new Set([...Object.values(SUP), ...Object.values(SUB)]);

/** A math alphabet (𝔸, 𝒜, 𝔄): letters (and digits) mapped, the rest unchanged; `holes` are the older Unicode letters. */
function alphabet(upper: number, lower: number, holes: string, digits?: number) {
	const h = pairs(holes.replace(/[^A-Za-z]/g, ''), holes.replace(/[A-Za-z]/g, ''));
	return (s: string) =>
		Array.from(s, (c) => {
			if (h[c]) return h[c];
			const n = c.charCodeAt(0);
			if (n >= 65 && n <= 90) return String.fromCodePoint(upper + n - 65);
			if (n >= 97 && n <= 122) return String.fromCodePoint(lower + n - 97);
			if (digits !== undefined && n >= 48 && n <= 57) return String.fromCodePoint(digits + n - 48);
			return c;
		}).join('');
}
const FONTS: Record<string, (s: string) => string> = {
	mathbb: alphabet(0x1d538, 0x1d552, 'CℂHℍNℕPℙQℚRℝZℤ', 0x1d7d8),
	mathcal: alphabet(0x1d49c, 0x1d4b6, 'BℬEℰFℱHℋIℐLℒMℳRℛeℯgℊoℴ'),
	mathscr: alphabet(0x1d49c, 0x1d4b6, 'BℬEℰFℱHℋIℐLℒMℳRℛeℯgℊoℴ'),
	mathfrak: alphabet(0x1d504, 0x1d51e, 'CℭHℌIℑRℜZℨ')
};
FONTS.Bbb = FONTS.mathbb;

/** `x^{…}` / `x_{…}`: Unicode super/subscripts when every character has one, else `^`/`_` kept. */
function script(content: string, sup: boolean) {
	const t = content.replace(/\s+/g, '');
	if (!t) return '';
	const table = sup ? SUP : SUB;
	const chars = Array.from(t);
	if (chars.every((c) => table[c])) return chars.map((c) => table[c]).join('');
	const op = sup ? '^' : '_';
	return chars.length === 1 || /^[\p{L}\p{N}]+$/u.test(t) ? op + t : `${op}(${content.trim()})`;
}

/** One letter or a number (subscripts and roots aside): needs no parentheses after √ or around a fraction part. */
const atomic = (s: string) => /^[√∛∜]?(\p{L}|[\p{N}.]+)$/u.test(Array.from(s.trim()).filter((c) => !SCRIPT_CHARS.has(c)).join(''));

/** `wide`: a math accent, over several letters (\widehat{xy}) it has no single character: the letters as is. */
function accent(base: string, mark: string, wide = false) {
	const chars = Array.from(base);
	// \~{} prints the accent itself.
	if (!chars.length) return { '\u0303': '~', '\u0302': '^', '\u0301': '´', '\u0300': '`', '\u0308': '¨' }[mark] ?? '';
	const first = chars[0] === 'ı' ? 'i' : chars[0] === 'ȷ' ? 'j' : chars[0];
	if (wide && chars.length > 1) return base;
	return (first + mark).normalize('NFC') + chars.slice(1).join('');
}

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

class Parser {
	i = 0;
	constructor(readonly s: string) {}

	/** Until `}` (when in a group) or the end. */
	seq(math: boolean, group = false): string {
		let out = '';
		while (this.i < this.s.length) {
			if (group && this.s[this.i] === '}') {
				this.i++;
				return out;
			}
			out += this.atom(math);
		}
		return out;
	}

	/** A command's argument: a {group}, a command, or one character. */
	arg(math: boolean): string {
		const s = this.s;
		while (this.i < s.length && /\s/.test(s[this.i])) this.i++;
		if (this.i >= s.length) return '';
		if (s[this.i] === '{') {
			this.i++;
			return this.seq(math, true);
		}
		if (s[this.i] === '\\') return this.command(math);
		const c = String.fromCodePoint(s.codePointAt(this.i)!);
		this.i += c.length;
		return math && c === '-' ? '−' : c;
	}

	/** `[…]` right here (\sqrt[3]{x}), else undefined. */
	optional(math: boolean): string | undefined {
		if (this.s[this.i] !== '[') return;
		const end = this.s.indexOf(']', this.i);
		if (end < 0) return;
		const inner = this.s.slice(this.i + 1, end);
		this.i = end + 1;
		return new Parser(inner).seq(math);
	}

	/** Math from here to `close` (or the end). */
	mathUntil(close: string) {
		const end = this.s.indexOf(close, this.i);
		const inner = this.s.slice(this.i, end < 0 ? undefined : end);
		this.i = end < 0 ? this.s.length : end + close.length;
		return new Parser(inner).seq(true);
	}

	atom(math: boolean): string {
		const s = this.s;
		const c = s[this.i];
		if (c === '\\') return this.command(math);
		if (c === '{') {
			this.i++;
			return this.seq(math, true);
		}
		this.i++;
		if (c === '}') return '';
		if (math) {
			if (c === '^' || c === '_') return script(this.arg(true), c === '^');
			if (c === "'") return '′';
			if (c === '-') return '−';
			if (c === '~') return ' ';
			if (c === '&') return ' ';
			return c;
		}
		if (c === '$') return this.dollar();
		if (c === '-' && s[this.i] === '-') {
			const em = s[this.i + 1] === '-';
			this.i += em ? 2 : 1;
			return em ? '—' : '–';
		}
		if (c === '`' && s[this.i] === '`') return (this.i++, '“');
		if (c === "'" && s[this.i] === "'") return (this.i++, '”');
		// A tie (Fig.~3), not "~1B tokens".
		if (c === '~') return !isSpace(s[this.i - 2]) && !isSpace(s[this.i]) ? ' ' : '~';
		return c;
	}

	/** At a `$` (already consumed): math if it pairs up like TeX math, else a dollar sign. */
	dollar(): string {
		const s = this.s;
		const start = this.i - 1;
		if (s[this.i] === '$') {
			const end = s.indexOf('$$', this.i + 1);
			if (end > this.i + 1) {
				this.i++;
				return this.mathUntil('$$');
			}
			return '$';
		}
		// The next unescaped `$` closes it: content can't start or end with a space,
		// nor the closing `$` be followed by a digit ("$5-$10").
		let end = start + 1;
		while (end < s.length && s[end] !== '$') end += s[end] === '\\' ? 2 : 1;
		if (end >= s.length || end === start + 1 || isSpace(s[start + 1]) || isSpace(s[end - 1]) || /\d/.test(s[end + 1] ?? '')) return '$';
		return this.mathUntil('$');
	}

	command(math: boolean): string {
		const s = this.s;
		this.i++;
		if (this.i >= s.length) return '\\';
		// A control word (\alpha) or symbol (\&).
		const name = /^[a-zA-Z]+/.exec(s.slice(this.i))?.[0] ?? String.fromCodePoint(s.codePointAt(this.i)!);
		this.i += name.length;

		if (name.length === 1 && !/[a-zA-Z]/.test(name)) {
			if ('&%_$#{}'.includes(name)) return name;
			if (name === '|') return '‖';
			if (',:;> '.includes(name) || name === '\\') return ' ';
			if (name === '(') return this.mathUntil('\\)');
			if (name === '[') return this.mathUntil('\\]');
			if (TEXT_ACCENTS[name]) return accent(this.arg(math), TEXT_ACCENTS[name]);
			// \! \/ \- \) \] and the like.
			return '';
		}
		if (GREEK[name]) return GREEK[name];
		if (SYMBOLS[name]) return SYMBOLS[name];
		if (NAMED.has(name)) return name;
		if (IGNORE.has(name)) {
			// \left. is an invisible delimiter.
			if ((name === 'left' || name === 'right' || name === 'middle') && s[this.i] === '.') this.i++;
			return '';
		}
		if (SPACE.has(name)) return ' ';
		if (s[this.i] === '*') this.i++;
		if (TEXT_MODE.has(name)) return this.arg(false);
		if (STYLE.has(name)) return this.arg(math);
		if (FONTS[name]) return FONTS[name](this.arg(math));
		if (MATH_ACCENTS[name]) return accent(this.arg(math), MATH_ACCENTS[name], true);
		if (TEXT_ACCENTS[name]) return accent(this.arg(math), TEXT_ACCENTS[name]);
		if (DROP.has(name)) {
			this.optional(math);
			return (this.arg(math), '');
		}
		switch (name) {
			case 'frac':
			case 'dfrac':
			case 'tfrac':
			case 'cfrac': {
				const wrap = (x: string) => (atomic(x) ? x.trim() : `(${x.trim()})`);
				const a = this.arg(true);
				return `${wrap(a)}/${wrap(this.arg(true))}`;
			}
			case 'binom':
			case 'dbinom':
			case 'tbinom': {
				const n = this.arg(true);
				return `C(${n.trim()}, ${this.arg(true).trim()})`;
			}
			case 'sqrt': {
				const n = this.optional(true)?.trim();
				const x = this.arg(true).trim();
				const root = !n ? '√' : n === '3' ? '∛' : n === '4' ? '∜' : script(n, true) + '√';
				return root + (atomic(x) ? x : `(${x})`);
			}
			case 'not': {
				const x = this.arg(math);
				return x === '=' ? '≠' : x === '∈' ? '∉' : x === '∃' ? '∄' : (x + '\u0338').normalize('NFC');
			}
			case 'textsuperscript':
			case 'textsubscript':
				return script(this.arg(false), name === 'textsuperscript');
			case 'ensuremath':
				return this.arg(true);
			case 'href':
				this.arg(false);
				return this.arg(false);
			case 'url':
				return this.arg(false);
			case 'textcolor':
				this.arg(false);
				return this.arg(math);
		}
		// An unknown macro (\ours): its name is better than nothing.
		return name;
	}
}

// Shown titles recur (grid, window titles): converted once.
const cache = new Map<string, string>();

/** LaTeX in a title as readable Unicode: "$\alpha$-divergence" → "α-divergence". */
export function latexToUnicode(s: string): string {
	if (!/[\\${}~]|--|``|''/.test(s)) return s;
	let out = cache.get(s);
	if (out === undefined) {
		out = new Parser(s).seq(false).replace(/\s+/g, ' ').trim();
		if (cache.size > 2000) cache.clear();
		cache.set(s, out);
	}
	return out;
}
