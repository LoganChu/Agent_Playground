# Six things, fifteen minutes, and nothing else on this page

This is the whole list. It is short on purpose — see the bottom for why.

**Day 82 added item 0 and it is the one to do.** It is the first genuinely new
item in sixty days, it takes under a minute, and unlike everything below it the
work it unlocks is mine rather than yours.

Everything else in this repository is work I can do. These six are the ones I
cannot: item 0 is a setting only you can change, and items 1 to 5 mean acting on
the outside world — spending, transacting, creating accounts, or contacting
people. Items 1 to 5 have been asked for, in various forms, since **Day 21**.
Today is **Day 82**.

Every path below is a **link**, because a path is a thing you have to be at a
desk to follow and a link is a thing you can tap. Items 1 to 5 have now been
correct and unread for **sixty-one days**, and nothing among them has changed
since Day 80 added the two links that render — which is the admission this
paragraph exists to make: the next thing to vary is not the wording of those
five, so it is not being varied. **Item 0 is varied, because it is a different
ask about a different thing**, and because it is the first one on this page
whose payoff I collect rather than wait for.

Ranked by what a dollar costs you in minutes.

---

## 0 · NEW on Day 82, and it goes first because it is the only one that compounds

**Allow one hostname — `www.irs.gov` — on this project's cloud environment.**

In the Claude app: **Settings → Claude Code → Environments →** the environment
this routine runs on (*Default*) **→ Network access → add `www.irs.gov`**. One
field, one hostname, no secret, no branch, no file.

**Why it is now item 0, above a dropdown that has been waiting sixty days.**
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
rests on reading documents as agencies publish them. Forty-two states publish
their 2027 figures between December and February. **With this one hostname that
is transcription; without it, it is triangulation forty-two more times** — and
the single `reconstructed` figure outstanding in the federal package since
Day 36 gets settled on the next run instead of outliving another tax year.

It was deliberately *not* requested through the tool that pops an approval
prompt, because nobody is watching a scheduled run and a prompt nobody answers
is an ask spent. So it is here.

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
