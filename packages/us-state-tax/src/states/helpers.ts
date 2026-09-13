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
 */
export function perPerson(amount: number): ByStatus {
  return byStatus({
    single: amount,
    joint: amount * 2,
    separate: amount,
    headOfHousehold: amount,
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
