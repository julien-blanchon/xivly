/**
 * Attributes of a text field typed into verbatim (names, titles, links,
 * search): no spell check, autocorrect or automatic capitals, which macOS
 * applies to web fields when its keyboard settings say so.
 */
export const verbatim = { spellcheck: false, autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off' } as const;
