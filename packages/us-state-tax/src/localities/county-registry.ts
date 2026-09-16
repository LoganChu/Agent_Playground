/**
 * The half of the county machinery that every county state shares, and nothing
 * shares back.
 *
 * It lives apart from `counties.ts` to break a genuine ES module CYCLE. The
 * registry lookup used to sit in `counties.ts` alongside the state dispatch, so
 * `counties.js` imported `indiana.js`, `maryland.js`, `michigan.js` and
 * `ohio.js` for the dispatch and all four imported `counties.js` back for the
 * lookup. Four cycles.
 *
 * Node and TypeScript both tolerate that — every binding across the cycle is a
 * hoisted function declaration, so it is resolved by the time anyone calls it —
 * which is why it survived thirteen days without a symptom. A cycle that works
 * by luck is still a cycle, and it has one: it cannot be expressed at all by
 * any loader that has to produce a module before anything can reference it.
 * The single-file build of the site is exactly such a loader, and it found this
 * by recursing until the stack ran out.
 *
 * THE RULE: a dependency cycle is invisible until something has to serialise
 * your module graph, and then it is not a style question. The dispatch depends
 * on the states and the states depend on the lookup; putting the lookup in the
 * same file as the dispatch made a leaf into a root.
 */
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { StateCode } from '../types.js';

/**
 * Normalise a county name for matching.
 *
 * Case, punctuation and the abbreviation "Co." are all optional, because a
 * caller — often a language model filling in a form — writes "montgomery",
 * "Montgomery County" and "MONTGOMERY CO." for the same place. The word
 * "County" itself is handled by the lookup rather than stripped here, because
 * stripping it would erase the only thing separating Baltimore City from
 * Baltimore County.
 */
export function normaliseCounty(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\bco\b/g, 'county')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "A and B", "A, B and C" — the ambiguity message reads to a person and to a
 * model, and Ohio has three villages called Oakwood where Maryland had two
 * Baltimores.
 */
function listOf(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One state's county table for one year, keyed by normalised name. */
export type CountyRegistry = ReadonlyMap<string, LocalIncomeTaxDefinition>;

export interface CountyLookup {
  /** The display names, in the order the state's own chart lists them. */
  readonly names: readonly string[];
  /** Names that must not be resolved, and what they could mean. */
  readonly ambiguous?: ReadonlyMap<string, readonly string[]>;
  readonly byYear: ReadonlyMap<number, CountyRegistry>;
  /** How the state describes its jurisdictions, for the error message. */
  readonly describe: string;
  /**
   * The word a caller may leave off the end of a name — "County" for Maryland
   * and Indiana. `null` for a state whose jurisdictions are cities, where there
   * is no suffix to make optional and claiming there is one would be a lie in
   * the error message a model reads.
   */
  readonly suffix?: string | null;
  /** What one of these jurisdictions is called, for the error message. */
  readonly noun?: string;
}

/**
 * Resolve a county name to its definition for a year.
 *
 * @throws {RangeError} when the name is not one of the state's jurisdictions,
 * when it is ambiguous, or when the year is not supported. Every message names
 * the alternatives: the caller is often a language model, and a model that
 * cannot see the list will invent a county that does not exist.
 */
export function resolveCounty(
  lookup: CountyLookup,
  state: StateCode,
  county: string,
  year: number,
): LocalIncomeTaxDefinition {
  const key = normaliseCounty(county);
  // Checked before the lookup, so that dropping the "County" suffix — which is
  // otherwise allowed — cannot silently resolve Baltimore County.
  const ambiguous = lookup.ambiguous?.get(key);
  if (ambiguous) {
    throw new RangeError(
      `"${county}" is ambiguous in ${state}: ${listOf(ambiguous)} are separate ` +
        `jurisdictions that set their own income tax rates. Name which one.`,
    );
  }
  const suffix = lookup.suffix === undefined ? 'county' : lookup.suffix;
  const noun = lookup.noun ?? 'county';
  const forYear = lookup.byYear.get(year);
  if (!forYear) {
    throw new RangeError(
      `${state} ${noun} income tax is supported for ${[...lookup.byYear.keys()].join(' and ')}, ` +
        `not ${year}. Rates are revised every year, so there is no fallback to the nearer one.`,
    );
  }
  const def = forYear.get(key) ?? (suffix === null ? undefined : forYear.get(`${key} ${suffix}`));
  if (!def) {
    throw new RangeError(
      `"${county}" is not a ${state} taxing jurisdiction. ${lookup.describe}: ` +
        `${lookup.names.join(', ')}.` +
        (suffix === null || suffix === ''
          ? ' Matching ignores case.'
          : ` The word "${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}" is optional and matching ignores case.`),
    );
  }
  return def;
}

/** Build the year-keyed registry from a per-year definition builder. */
export function countyRegistry(
  years: readonly number[],
  build: (year: number) => readonly LocalIncomeTaxDefinition[],
): ReadonlyMap<number, CountyRegistry> {
  return new Map(
    years.map((year) => [
      year,
      new Map(build(year).map((def) => [normaliseCounty(String(def.code)), def])),
    ]),
  );
}
