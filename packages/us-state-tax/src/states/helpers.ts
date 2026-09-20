import type { NoteRelevance } from '../definition.js';
import type { ByStatus, FilingStatus } from '../types.js';

/**
 * Build a by-status table from the four distinct amounts states actually use.
 *
 * `qualifyingSurvivingSpouse` defaults to the joint amount, which is the near
 * universal rule: a surviving spouse files on the joint schedule for the two
 * years after the death. Georgia is the exception in this package and passes it
 * explicitly — see `georgia.ts`.
 */
export function byStatus(v: {
  single: number;
  joint: number;
  separate: number;
  headOfHousehold: number;
  qualifyingSurvivingSpouse?: number;
}): ByStatus {
  return {
    single: v.single,
    marriedFilingJointly: v.joint,
    marriedFilingSeparately: v.separate,
    headOfHousehold: v.headOfHousehold,
    qualifyingSurvivingSpouse: v.qualifyingSurvivingSpouse ?? v.joint,
  };
}

/** The same amount for every filing status. */
export function uniform(amount: number): ByStatus {
  return byStatus({
    single: amount,
    joint: amount,
    separate: amount,
    headOfHousehold: amount,
  });
}

/**
 * The common per-exemption pattern: one for a single filer, two on a joint return.
 * Married filing separately gets one; head of household gets one.
 *
 * **And ONE for a qualifying surviving spouse**, which is where this helper
 * differs from {@link byStatus} and why it has to say so. `byStatus` defaults
 * that status to the joint figure, because a *statutory* figure for a surviving
 * spouse usually is the joint one — § 63(c)(2)(A) says so for the federal
 * standard deduction and most states follow.
 *
 * This is not a statutory figure. It is a count of people, and a surviving
 * spouse is one person: the spouse is dead, the return has one filer on it, and
 * every state form that asks for this asks the filer to tick a box for
 * themselves and another for a spouse *if filing jointly*. Taking the joint
 * amount gives a widow an exemption for a person who is not there.
 *
 * It was doing exactly that until Day 26, in Illinois, Indiana and Michigan —
 * `$141.08`, `$49.70` and `$246.50` a year — and no test saw it because no case
 * in the differential grid had ever filed as a surviving spouse.
 */
export function perPerson(amount: number): ByStatus {
  return byStatus({
    single: amount,
    joint: amount * 2,
    separate: amount,
    headOfHousehold: amount,
    qualifyingSurvivingSpouse: amount,
  });
}

export function byStatusOf<T>(v: {
  single: T;
  joint: T;
  separate: T;
  headOfHousehold: T;
  qualifyingSurvivingSpouse?: T;
}): ByStatus<T> {
  return {
    single: v.single,
    marriedFilingJointly: v.joint,
    marriedFilingSeparately: v.separate,
    headOfHousehold: v.headOfHousehold,
    qualifyingSurvivingSpouse: v.qualifyingSurvivingSpouse ?? v.joint,
  };
}

/**
 * Whether either person on the return has military retired pay.
 *
 * The first relevance predicate, and the one that pays best: Georgia carries
 * three notes about its military exclusion and Maryland one about its military
 * subtraction, all of them long, and the overwhelming majority of returns in
 * either state have no military pay on them at all.
 */
export const whenMilitaryRetirement: NoteRelevance = (input) =>
  (input.retirement?.filer?.militaryRetirement ?? 0) > 0 ||
  (input.retirement?.spouse?.militaryRetirement ?? 0) > 0;

/** Whether anyone on the return has reached an age. */
export const whenAgedAtLeast =
  (age: number): NoteRelevance =>
  (input) =>
    (input.filerAge !== undefined && input.filerAge >= age) ||
    (input.spouseAge !== undefined && input.spouseAge >= age);

export type { FilingStatus, NoteRelevance };
