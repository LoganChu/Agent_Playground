import type { SeparateReturnRule } from '../types.js';

/**
 * Whether each Schedule 1-A deduction reaches a married individual who files a
 * separate return — **shared by every year, because none of these is a figure.**
 *
 * Each of the four is a sentence Congress either wrote or did not write, and
 * three of the four wrote it in almost identical words:
 *
 * | | provision | words |
 * | --- | --- | --- |
 * | tips | § 224(f) | "this section shall apply only if the taxpayer and the taxpayer's spouse file a joint return" |
 * | overtime | § 225(e) | the same sentence, one section later |
 * | senior | § 151(d)(5)(C)(v) | the same restriction, in the paragraph OBBBA § 70103 added |
 * | vehicle loan interest | § 163(h)(4) | **nothing. There is no married-individuals clause.** |
 *
 * The fourth is the one worth the money, and it was wrong here until v0.12.0
 * because a single `ineligibleFilingStatuses` list on the parent object answered
 * for all four at once. Three signals agree that a separate return may claim it:
 *
 * 1. **The statute's own shape.** § 163(h)(4) runs (A) in general, (B) the
 *    definition, (C) the limitations — the $10,000 cap and the $200-per-$1,000
 *    reduction above "$100,000 ($200,000 in the case of a joint return)" — and
 *    (D) the applicable passenger vehicle. Three sections drafted in the same act
 *    say the sentence; this one does not, and a $100,000 non-joint threshold has
 *    nothing to bite on if no non-joint married return can claim the deduction.
 * 2. **The regulations say so directly**, in the course of explaining the cap:
 *    § 1.163-16(h)(1) makes the $10,000 limitation one that "applies per Federal
 *    tax return", so a couple filing separately reach $10,000 EACH where a joint
 *    return caps at $10,000 between them — on a $100,000 threshold rather than
 *    $200,000. Nobody writes a rule about how a cap divides across separate
 *    returns that cannot claim the deduction.
 * 3. **PolicyEngine-US applies it to every filing status**, keyed on the same
 *    threshold table. (It also applies the other three to every filing status,
 *    which is the mirror-image error — so this is corroboration on one point, not
 *    a model to copy.)
 *
 * `cite` is not decoration. `test/married-filing-separately.test.js` fails if any
 * two of the four are equal, because one citation covering several provisions is
 * exactly the shape the defect had: two subsections that somebody read, and two
 * more carried along on the strength of them.
 */

/** § 224(f). Tips: a married individual must file jointly. */
export const TIPS_SEPARATE_RETURN: SeparateReturnRule = {
  allowed: false,
  cite:
    '§ 224(f): if the taxpayer is a married individual (within the meaning of § 7703), ' +
    "§ 224 applies only if the taxpayer and the taxpayer's spouse file a joint return.",
};

/** § 225(e). Overtime: the same sentence, one section later. */
export const OVERTIME_SEPARATE_RETURN: SeparateReturnRule = {
  allowed: false,
  cite:
    '§ 225(e) ("Married individuals"): § 225 applies to a married individual only if ' +
    'the taxpayer and the spouse file a joint return for the taxable year.',
};

/** § 151(d)(5)(C)(v). The senior deduction: the same restriction again. */
export const SENIOR_SEPARATE_RETURN: SeparateReturnRule = {
  allowed: false,
  cite:
    '§ 151(d)(5)(C)(v), added by OBBBA § 70103: the enhanced deduction for seniors is ' +
    'allowed to a married individual only on a joint return, so a separate return gets ' +
    '$0 of it at any income.',
};

/**
 * § 163(h)(4). Vehicle loan interest: **allowed**, because no clause bars it.
 *
 * The citation is to an absence, which is the only honest way to write it: what
 * settles this is that subparagraphs (A) through (D) contain no married-
 * individuals sentence while the three provisions above each do.
 */
export const VEHICLE_LOAN_INTEREST_SEPARATE_RETURN: SeparateReturnRule = {
  allowed: true,
  cite:
    '§ 163(h)(4) has no married-individuals clause — (A) in general, (B) the definition, ' +
    '(C) the $10,000 cap and the $200-per-$1,000 reduction above "$100,000 ($200,000 in ' +
    'the case of a joint return)", (D) the applicable passenger vehicle, and nothing ' +
    'requiring a joint return. § 1.163-16(h)(1) confirms it from the other side: the ' +
    '$10,000 limitation "applies per Federal tax return", so where two taxpayers file ' +
    "separately it applies separately to each taxpayer's return.",
};
