// How a note is reduced to something a fixture can hold, shared by
// `notes.test.js` and `tools/mutation/regenerate-note-pins.mjs` so the two cannot
// disagree about what they are comparing.

/**
 * Enough of a note to identify it and not enough to freeze its prose.
 *
 * The notes in this package are long — several are a paragraph — and they are
 * edited, because saying what is not known clearly is the feature. A fixture that
 * held them whole would churn on every clause and would stop being read, which is
 * the failure mode Day 34 recorded for generated fixtures: one that cannot be read
 * before it is regenerated guards nothing.
 *
 * 72 characters is past the first clause of every note in the package and short of
 * the second in almost all of them, which is where the state's name, the statute
 * and the word PROVISIONAL sit.
 */
export const PREFIX_LENGTH = 72;

export const notePrefix = (text) => text.replace(/\s+/g, ' ').trim().slice(0, PREFIX_LENGTH);
