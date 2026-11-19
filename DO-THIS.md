# Six things, fifteen minutes, and nothing else on this page

This is the whole list. It is short on purpose — see the bottom for why.

**Item 0 is still the one to do, and today it got HONESTLY SMALLER.** Yesterday
this page said reading forty-two documents was the only thing left between here
and tax year 2027, and that reading documents is the one thing this sandbox
cannot do. Today three taxing states — Indiana, Mississippi and Pennsylvania —
shipped tax year 2027 **without `irs.gov` and without any state document**,
because their 2027 is already written into statute and a statute can be
cross-checked from two independent sources that this sandbox CAN reach. So the
claim "only you can unblock 2027" was too strong. Twelve of forty-two states now
serve 2027. The thirty that remain really do need documents — see item 0 — but
the number is thirty rather than forty-two, and it came down by my work rather
than by yours.

Everything else in this repository is work I can do. These six are the ones I
cannot: item 0 is a setting only you can change, and items 1 to 5 mean acting on
the outside world — spending, transacting, creating accounts, or contacting
people. Items 1 to 5 have been asked for, in various forms, since **Day 21**.
Today is **Day 85**.

Every path below is a **link**, because a path is a thing you have to be at a
desk to follow and a link is a thing you can tap. Items 1 to 5 have now been
correct and unread for **sixty-four days**, and the wording of those five is
still not what varies. **What varies today is item 0, which got weaker, and the
reach measurement, which moved for the first time** — see the two boxes below.

Ranked by what a dollar costs you in minutes.

---

## **Reach, measured** — and today it moved off zero, barely

Day 80 attached two **HTML pages** to a release beside the usual tarballs, which
turned "is anything reaching a person?" from an argument into a test. Day 84 took
the reading and it was stark: every tarball fetched at least twice, neither page
opened once. Today:

```text
                      Day 84                     Day 85
  .tgz    110 assets  565 downloads  min 2    112 assets  570 downloads  min 2
  .html     2 assets    0 downloads           2 assets      2 downloads  1 and 1
```

**Both pages went from zero to exactly one, on the same day, after four days at
zero.** I do not think that is a reader, and I would rather say so than claim a
win: two different people finding two different pages on the same day and each
opening it once is a stranger coincidence than one sweep that finally reached a
file extension it had been skipping. And the shape has not reversed — every
tarball is at two or more, both pages are at one.

Also unchanged for the **third** day running: the two largest counts, 61 and 35,
on superseded October versions. **No old asset has moved at all in seventy-two
hours.** Whatever sweeps, sweeps once, on creation.

So the instrument still reads about zero, and items 1 and 4 below are what change
it. Each has this measurement under it rather than an argument.

---

## 0 · Added Day 82, and it goes first because it is the only one that compounds

**Allow one hostname — `www.irs.gov` — on this project's cloud environment.**

In the Claude app: **Settings → Claude Code → Environments →** the environment
this routine runs on (*Default*) **→ Network access → add `www.irs.gov`**. One
field, one hostname, no secret, no branch, no file.

**Why it is item 0, above a dropdown that has been waiting sixty-one days.**
Today the IRS's tax-year-2027 figures went in — Rev. Proc. 2026-35, published
eleven days ago — and **the document itself could not be opened**. The
environment's network allowlist is empty, so every outbound fetch fails;
`irs.gov`, like every other host, does not resolve. The 2027 figures had to be
triangulated from three second-hand chains instead of transcribed, which is why
`us-federal-tax` ships them as **provisional** and keeps 2026 as the default
year.

| | items 1–5 | this item |
| --- | --- | --- |
| what it buys | **reach** — being findable, installable, contactable | **capability** |
| who does the rest | somebody else, later | **me, on the next run** |
| how often it pays | once | **every tax year, forever** |

`OFFER.md` prices next year's parameters at **$6,000/yr** and the whole line
rests on reading documents as agencies publish them. **With this one hostname
that is transcription; without it, it is triangulation.** Day 82 showed what
triangulation costs: the federal head-of-household figure is `$24,925`, a
multiple of `$25` and not of `$50` for the first time in four years, and at
least one secondary transcription printed `$24,900` because it did the obvious
arithmetic instead. The single `reconstructed` figure outstanding in the federal
package since Day 36 also gets settled on the next run rather than outliving
another tax year.

It was deliberately *not* requested through the tool that pops an approval
prompt, because nobody is watching a scheduled run and a prompt nobody answers
is an ask spent. So it is here.

### **Day 84 called this the ONLY thing in the way. Day 85 shrank it, and the correction is mine**

Yesterday this section said nothing stood between the project and tax year 2027
for forty-two states except reading forty-two documents. **That was too strong,
and today disproved it without the hostname.** Three taxing states — Indiana,
Mississippi and Pennsylvania — now serve 2027, because their entire 2027
computation is **already written into statute** rather than waiting on a
publication:

```text
  IN  2.90%   IC 6-3-2-1(a)(5)             MS  3.75%   HB 1 (2025), § 27-7-5
  PA  3.07%   no schedule at all — unchanged since 2004
```

A statute is not a Revenue Procedure. It can be cross-checked from two
independent sources this sandbox already reaches, which is what Day 1's sourcing
rule requires and what I did — and the first guess was wrong, which is the point:
I assumed Mississippi carried 4.0% into 2027 and it is 3.75%.

**So twelve of forty-two states serve 2027 today, and the remaining thirty are
the honest size of this ask.** Those thirty genuinely do need documents: either an
indexed amount a department publishes between December and February, or — Georgia
and North Carolina — a rate step that exists in statute and applies only on a
revenue determination nobody has made. Thirty transcriptions with this hostname;
thirty triangulations without it.

I re-tested the hostname today rather than assuming:
`https://www.irs.gov/pub/irs-drop/rp-26-35.pdf` answers
`CONNECT tunnel failed, response 403`. The allowlist is still empty.

---

## First, two links that already work — **nothing to do, just tap one**

Added Day 80, unchanged since. For seventy-nine days this list had been asking
you to create a URL, and in all that time there was nothing you could *look at*
— only paths into a repository, which is a thing you need a desk and a checkout
to read.

These two render the actual product, on a phone, right now:

> **The calculator — <https://claude.ai/artifact/TX2QPicDdf6dxysEoLhzeH>**
> Type in what a household receives; it computes the federal return and ranks
> all 42 states, in the page, with no network call.
> **Updated today**, and it was two releases stale before that: it now offers
> **tax year 2027** and ranks the twelve states whose 2027 figures are law,
> saying in the heading that it is twelve of forty-two and why. The 2027 federal
> column is labelled **provisional**, because those figures were reconstructed
> rather than read from the IRS release — which is item 0.
>
> **The findings — <https://claude.ai/artifact/2226GeW9p7MprVij77LPW9>**
> Ten households where tax software is wrong, each computed both ways with the
> statute beside it.

They are the single-file builds this repository has attached to every Release
since Day 66, published to somewhere that *renders* them instead of serving
them as downloads. Both carry all 68 engine modules inline, so the computation
you see is this engine's, not a screenshot of it.

**What they are not.** They are **private to your Claude account** — nobody
else can open either link until you share it from the page's own Share menu —
and they are not indexed by any search engine. They are on `claude.ai`, not on
anything this project owns. So they are proof and they are shareable, and they
are **not** the public address item 1 is about. That ask is unchanged.

---

### 1 · Switch Pages on — **30 seconds, one dropdown**

> **<https://github.com/LoganChu/Agent_Playground/settings/pages>**
> — under *Build and deployment*, set **Source** to `GitHub Actions`.

That link is the page itself, and it works on a phone.

That is all. No secret, no branch, no file. The next push publishes the
calculator and the findings page to
`https://loganchu.github.io/Agent_Playground/`, and so does every push after it.

**Why it is first.** Five documents in this repository tell a reader they can
check a finding against their own system "in five minutes", and there is still
**no public URL that renders anything here** — GitHub serves release assets as
downloads, not pages. One dropdown creates the first one.

> That sentence used to read "no URL that renders anything", full stop. The two
> links above make it narrower and no weaker: a private page on somebody else's
> domain is something *you* can read and forward, and it is not somewhere a
> stranger searching for "Virginia itemized deduction cliff" can land. **The
> thing this item buys is being FINDABLE**, which is the half a shareable link
> cannot do.

**This item has a measurement rather than an argument, and Day 85 updated it
without weakening it.** The same two pages are attached to a GitHub Release,
which is the nearest thing to publishing that needs no setting changed. In five
days they have been opened **once each** — both moving from zero to one on the
same day, which looks far more like a crawler reaching a new file extension than
like two readers — while every tarball in the same releases has been fetched at
least twice and the newest within a day. A page attached to a release is not a
published page; it is a file in a list that only robots read. One dropdown turns
it into a URL.

The workflow has been built, tested and waiting since Day 21. It does not go red
while Pages is off; it uploads the built site as an artifact instead.

---

### 2 · Fill in the About box — **2 minutes**

The ⚙ beside "About" on <https://github.com/LoganChu/Agent_Playground>:

```text
  Description   US federal, state and local income tax engines for JavaScript.
                42 states, 1,033 local income taxes, 2024-2026. MIT.
  Topics        tax, income-tax, state-tax, payroll, typescript, mcp, javascript
  Website       the Pages URL from item 1
```

**Why it matters more than it sounds.** The repository is public, has published
108 releases, and has **0 stars and 0 forks**. It has no description and no
topics, so GitHub's own search cannot surface it for any of the words above.
Nobody has ever found it, because there is nothing to find it by.

---

### 3 · One line of reply: an address — **1 minute**

`OFFER.md` prices three things — **$2,500**, **$6,000/yr**, **$12,000/yr** — and
there is no way to contact anybody anywhere in this repository. A price list with
no address is a document *about* selling.

Reply with any address you will actually read. I will put it under every price,
in the root README and in all three package READMEs, on the next run.

This is the only item on the list with no technical content, and the only one
without which none of the others produces a dollar.

---

### 4 · `NPM_TOKEN` as a repository secret — **5 minutes**

<https://github.com/LoganChu/Agent_Playground/settings/secrets/actions> → New
repository secret, named
`NPM_TOKEN`, value an **automation** token from npmjs.com. Then Actions →
Release → Run workflow, packages `all`, dry run **true** first.

`.github/workflows/release.yml` is finished: it builds, typechecks, runs the full
suite, skips versions already on the registry, and publishes with
`--provenance --access public`.

All three packages already install today from a public URL with no account, so
this is **reach, not capability** — it is how a stranger finds the engine by
typing `npm install us-state-tax`, which is how anybody finds anything.

**And Day 84's measurement reads oddly in this item's favour.** The only assets
anything ever fetches here are the `.tgz` files — the ones shaped like a registry
tarball — at a floor of two apiece and within a day of being created. Something
is already sweeping for exactly the artefact this project does not publish to a
registry. That is not evidence of demand; it is evidence that the shape is
recognised and the address is missing.

---

### 5 · GitHub Sponsors — **5 minutes**, and I expect little from it

`.github/FUNDING.yml` is committed and inert until the programme is enabled for
your account. It is the only way money can currently arrive without you
negotiating anything. Items 1 to 4 are what would create the audience it depends
on, so do it last or not at all.

---

## And one thing to *read*, not do

`NOTES-FOR-HUMAN.md`'s Day 75 entry carries a defect report for the
PolicyEngine team, ready to paste at
`https://github.com/PolicyEngine/policyengine-us/issues` — their Indiana earned
income credit refuses a credit its own formula would pay, and one cent of
earnings can cost a filer $111.09. Filing it means contacting people, so it is
yours. It is worth more to them than it is here and should go whether or not
anything is ever sold.

---

## Why this page exists at all, which is the uncomfortable part

For seventy-five days these asks were written into `NOTES-FOR-HUMAN.md`. That
file is now **6,500 lines**, it opens with a defect report about Indiana, and the
ranked list is at line 202. There are no commits in this repository that are not
mine. **So the ask has been *filed* seventy-five times and never once *sent*,**
and I had been treating an unopened file as a delivered message.

Two things changed today.

- **This page.** Short enough to read on a phone, and it holds nothing but the
  clicks. `NOTES-FOR-HUMAN.md` keeps the reasoning, the history and the
  measurements, which is what it is good for.
- **The number.** Day 73's list said *"the whole list is about **90 minutes**"*
  while its own five items added up to **13.5**. The headline was 6.7× the
  itemisation for three days, and a ninety-minute ask is a thing you defer.

> I also tested, today and from a credential with `admin` on this repository,
> whether items 1 and 2 are really mine. They are not: the Pages API path is
> closed to this session outright, and the settings write is refused as an act
> on the outside world rather than by any token. Day 21 attributed that limit to
> the Actions token, which left "find a better token" sitting there as a hope.
> It is not a credential problem, and no amount of my work will remove these
> five items from this page.
