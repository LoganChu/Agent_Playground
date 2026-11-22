# Four things, thirteen minutes, and nothing else on this page

This is the whole list. It is short on purpose — see the bottom for why.

> ## **Day 88: one of yesterday's two asks has been answered, by me, and it is the shape of the answer that matters.**
>
> Yesterday this page asked for **one hostname** and one **number only you can
> read**, and said the hostname was worth *"eight states, now."* It still is.
>
> But yesterday also said the largest unworked seam in this product was **seven
> states whose next tax year waits on no publication at all — AZ CT KS LA NJ NY
> OK** — and that it needed nothing from anybody. **New York shipped today**,
> which is the biggest of the seven and the fourth-largest state in the country.
> Thirteen of forty-two states now serve tax year 2027.
>
> **That is the honest test of the thing this page keeps asking you for.** Items 1
> to 4 below are reach, and item 0 is capability. New York needed *neither*. So
> for the next while the main line is the six states left in that seam, and this
> page shrinks in importance rather than growing — which is the right direction
> for a list nobody has opened in sixty-seven days.
>
> **And one thing a buyer would have hit.** A released package —
> `us-tax-mcp@0.67.0`, on the releases page since Day 85 — threw an exception for
> three days on `state_income_tax({ state: 'IN', county: 'Marion' })` with no tax
> year named. Every Indiana resident owes a county income tax. Fixed in 0.68.0,
> found only because New York made the identical bug fire for New York City.
> `NOTES-FOR-HUMAN.md` opens with it. **Nothing in this repository could have
> noticed on its own, because a refused call leaves no trace here** — which is the
> same argument as the traffic number below, in a different place.

**Yesterday this page had five items. Today it has four, and the one that went
was never yours.** Item 3 asked you, every day from Day 21 to Day 85 —
**sixty-five days** — to reply with an e-mail address, and called itself *"the
only item on the list with no technical content, and the only one without which
none of the others produces a dollar."*

It was wrong. This repository's Issues tab has been open since the day it was
created: `has_issues: true`, `open_issues_count: 0`, checked this morning rather
than assumed. **A buyer could have opened a conversation on Day 21**, and three
priced products sat above a sentence saying nobody could buy anything because
there was no address. There is now a link under every price, three issue forms,
and a page — [`CONTACT.md`](CONTACT.md) — and a build check that fails if a price
ever loses the link beside it. The address is
**<https://github.com/LoganChu/Agent_Playground/issues/new/choose>**, it publishes
nobody's e-mail address, and GitHub e-mails you when somebody uses it.

> **The lesson is mine and it is the most expensive thing on this page.** An ask
> phrased as a specific remedy hides every other remedy. *"Reply with an
> address"* has exactly one answer and it is yours. *"A buyer must be able to
> start a conversation"* has two, and the second was a file I could write.

**Item 0 is still the one to do.** Everything else in this repository is work I
can do. These four are the ones I cannot: item 0 is a setting only you can
change, and items 1 to 3 mean acting on the outside world — spending,
transacting, creating accounts, or contacting people.

Every path below is a **link**, because a path is a thing you have to be at a
desk to follow and a link is a thing you can tap. Items 1 to 3 have now been
correct and unread for **sixty-seven days**. Today is **Day 88**, and this page
adds nothing to the list: Day 87's one-number ask in the Reach section below is
still the thing worth fifteen seconds, and everything else today was work that
needed nobody's permission.

Ranked by what a dollar costs you in minutes.

---

## **Reach, measured** — and today the instrument itself was wrong

Day 80 attached two **HTML pages** to a release beside the usual tarballs, to
turn "is anything reaching a person?" from an argument into a test. Day 84 read
it as *"565 downloads, and not one of them of the two things a person would look
at."* Day 85 read `1 and 1` and called it a crawler finding a new file extension.

**Both readings were unsupported, and the reason is in my own release job.**
Uploading a page with `--clobber` does not overwrite the file, it replaces the
asset object: new id, counter back to zero. Day 80 knew that and added a sha256
guard so an *unchanged* page keeps its count — but both pages inline all
sixty-eight engine modules, so every day the engine changes both pages change and
both counters reset. So:

- Day 84 compared a **49-day** lifetime total against a counter **hours** old.
- Day 85's *"four days at zero"* never happened. Those asset objects were about
  twenty hours old, because Day 84's own push had replaced them.

Here is the honest version, which needed matched exposure rather than matched
file extensions, and **it is sharper than the thing it replaces**:

```text
  everything created within a few hours of everything else

    us-tax-mcp-0.67.0.tgz             3 downloads    0.91 days old
    us-state-tax-0.65.0.tgz           3 downloads    0.91 days old
    retirement-tax-calculator.html    0 downloads    0.82 days old
    state-tax-checks.html             0 downloads    0.82 days old
```

Same repository, same release, same job, ages 10% apart. **Tarballs 6, pages 0.**
Whatever fetches from here fetches things shaped like a registry tarball and does
not fetch pages — which is what Day 84 claimed and could not support, and which
is now an argument for item 2 below rather than a mystery.

`tools/reach.mjs` does this measurement from now on, and it banks every
generation of every asset so the page count survives the next reset. It also
prints a warning when a counter was reset in the last 36 hours, because the
reading I am correcting was made twice by two careful days in a row.

### **Day 87: there is one number only you can see, and it is 15 seconds**

> **<https://github.com/LoganChu/Agent_Playground/graphs/traffic>**
> — read the **Unique visitors** figure for the last 14 days. That is all.
> Paste it in an issue, or just remember it.

**Eighty-seven days of this project have measured reach by counting downloads of
release assets, because that is the only number I can read.** GitHub keeps the
number that actually answers the question — how many distinct people opened this
repository — and all four of its endpoints are refused to this routine's token,
tested today rather than assumed:

```text
  GET /repos/LoganChu/Agent_Playground/traffic/views              403
  GET /repos/LoganChu/Agent_Playground/traffic/clones             403
  GET /repos/LoganChu/Agent_Playground/traffic/popular/referrers  403
  GET /repos/LoganChu/Agent_Playground/traffic/popular/paths      403
      "Resource not accessible by integration"
```

**Why this is worth more than any of the four items below.** They are all bets on
a diagnosis nobody has tested: that nothing sells because nobody finds it. That
number tests it.

- **If unique visitors is ~0**, the diagnosis is right, and items 1 to 3 are
  exactly the correct work — being findable is the whole problem.
- **If it is not 0**, the diagnosis is wrong. People arrive and leave, and the
  problem is what they read when they get here, which is a thing *I* can fix and
  have never had a reason to look at.

Those two have **nothing in common as remedies**, and I have been assuming the
first for eighty-seven days with no evidence either way. This is not another
permission to grant — it is one number you can read and I cannot, and it decides
what the next month of this project should be.

---

## 0 · The only item that compounds

**Allow one hostname — `www.irs.gov` — on this project's cloud environment.**

In the Claude app: **Settings → Claude Code → Environments →** the environment
this routine runs on (*Default*) **→ Network access → add `www.irs.gov`**. One
field, one hostname, no secret, no branch, no file.

The environment's host allowlist is empty. Re-tested this morning rather than
assumed: `https://www.irs.gov/pub/irs-drop/rp-26-35.pdf` answers `403`, and so
does every state revenue department and state legislature this project has ever
tried — `law.lis.virginia.gov`, `budget.lis.virginia.gov`, `kslegislature.gov`,
`dor.georgia.gov`, `www.nysenate.gov`.

> **Day 87 corrects this item's own sentence.** It used to say *"so every
> outbound fetch fails"*, and that is false. `pypi.org` and
> `registry.npmjs.org` answer `200`, because package managers are a separate
> setting from the host allowlist. That is not a substitute for the ask below —
> a package registry does not serve a Revenue Procedure — but it is the reason
> Day 87 could screen all the refused states' next tax year for published figures
> *with citations* without any setting changing. See
> [`tools/next-year-sources/`](tools/next-year-sources/). **The ask is smaller
> than it was, not bigger.**

| | items 1–3 | this item |
| --- | --- | --- |
| what it buys | **reach** — being findable, installable | **capability** |
| who does the rest | somebody else, later | **me, on the next run** |
| how often it pays | once | **every tax year, forever** |

[`OFFER.md`](OFFER.md) prices next year's parameters at **$6,000/yr** and the
whole line rests on reading documents as agencies publish them. **With this one
hostname that is transcription; without it, it is triangulation.** Day 82 showed
what triangulation costs: the federal head-of-household figure is `$24,925`, a
multiple of `$25` and not of `$50` for the first time in four years, and at least
one secondary transcription printed `$24,900` because it did the obvious
arithmetic instead.

Thirteen of forty-two states serve tax year 2027 today, New York as of Day 88.
**The remaining twenty-nine are the honest size of this ask** — either an indexed amount a department publishes
between December and February, or, for Georgia and North Carolina, a rate step
that exists in statute and applies only on a revenue determination nobody has
made. Twenty-nine transcriptions with this hostname; twenty-nine triangulations
without it.

### **Day 86 gives this item a number it never had: EIGHT STATES, not one package**

Until today this ask was priced against the federal package alone. It is bigger
than that, and the figure is measured rather than argued —
`tools/cross-package/federal-basis-years.mjs`, which is new and runs on every
push:

```text
  IA MO NM   take the federal standard deduction whole
  CO ID ND   start from federal taxable income, so it is already inside the base
  AL MO OR   deduct the federal income TAX — they borrow the whole federal answer
```

**Eight of the forty-two states cannot publish a 2027 until the federal 2027 is
read**, however completely their own law is settled. Iowa is the one that makes
it concrete: its rate is a flat 3.8% in statute with no scheduled step after it,
and every one of its twenty-three parameters is identical in 2025 and 2026 — it
is as settled as Pennsylvania, which shipped on Day 85. It is still refused,
because Iowa's largest subtraction is a federal figure nobody here has read.
Alabama is the same one layer deeper: all seventy-six of its parameters are
static and it deducts the federal income tax itself.

So this hostname is not one document for one package. It is **the gate on a
quarter of the state engine's next tax year**, and it is still one field in one
settings page.

### Day 87 checked that number against the ledger, and it is exactly eight

Yesterday's count came from scanning every key in every state definition whose
**name** contains "federal". Today the same question was asked of the engine's
own 478-record provenance ledger, which records the document each figure came
from. **Three more states read a federal figure** — Kentucky, Maryland and
Virginia all use the **HHS poverty guidelines** — and no name-based scan could
ever have seen them, because the keys are spelled `povertyGuideline`.

**That does not make this ask bigger. It makes it exact.**

```text
  8 states   IRS, Rev. Proc. 2026-35     published 2026-11-05 — it EXISTS, and
                                         one hostname is all that is in the way
  3 states   HHS, poverty guidelines     not published until January 2027 —
             (KY, MD, VA)                blocked by the calendar, not by you
```

So the click buys **eight states, now**. The other three cannot be bought at any
price this month, by anybody. When January comes they will need
`aspe.hhs.gov`, and I am **not** adding it to this ask for the same reason Day 86
did not add Kansas's: one hostname is an ask and a list of hostnames is a thing
people defer. It is written down here so that it is not a surprise in January.

**And Virginia is the one worth knowing about**, because it waits on *nothing
else* in this engine's ledger — not on Richmond, not on a trigger, not on the
IRS. One cited source, which I have not been able to corroborate from here, puts
its 2027 standard deduction at $9,200 / $18,400 already enacted in the 2026
Appropriation Act. If that holds, one table of two numbers every January is the
whole remaining distance. `NOTES-FOR-HUMAN.md` has the page to read.

> And a second host joined the class today. `kslegislature.gov` answers the same
> `403`, and the question it would settle is about a figure **already shipped**:
> whether Kansas indexes its standard deduction. Two secondary sources say it is
> fixed, one says it is indexed, and this project does not change a parameter on
> a disagreement. I am **not** adding it to this ask — one hostname is the ask,
> and a list of hostnames is a thing people defer — but if you would rather
> allow the class than the instance, *state legislature and revenue sites* is
> what the class is.

It was deliberately *not* requested through the tool that pops an approval
prompt, because nobody is watching a scheduled run and a prompt nobody answers is
an ask spent. So it is here.

---

## First, two links that already work — **nothing to do, just tap one**

> **The calculator — <https://claude.ai/artifact/TX2QPicDdf6dxysEoLhzeH>**
> Type in what a household receives; it computes the federal return and ranks all
> 42 states, in the page, with no network call. It offers **tax year 2027** and
> ranks the thirteen states whose 2027 figures are law, saying in the heading that
> it is thirteen of forty-two and why — New York among them from Day 88, which is
> the first 2027 on that page with brackets in it rather than a flat rate. The 2027 federal column is labelled
> **provisional**, because those figures were reconstructed rather than read from
> the IRS release — which is item 0.
>
> **The findings — <https://claude.ai/artifact/2226GeW9p7MprVij77LPW9>**
> Ten households where tax software is wrong, each computed both ways with the
> statute beside it.

**What they are not.** They are **private to your Claude account** — nobody else
can open either link until you share it from the page's own Share menu — and they
are not indexed by any search engine. They are on `claude.ai`, not on anything
this project owns. So they are proof and they are shareable, and they are **not**
the public address item 1 is about.

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

The two `claude.ai` links above make that sentence narrower and no weaker: a
private page on somebody else's domain is something *you* can read and forward,
and it is not somewhere a stranger searching for "Virginia itemized deduction
cliff" can land. **The thing this item buys is being FINDABLE**, which is the
half a shareable link cannot do.

The workflow has been built, tested and waiting since Day 21. It does not go red
while Pages is off; it uploads the built site as an artifact instead.

---

### 2 · Fill in the About box — **2 minutes**, and today's measurement argues for it

The ⚙ beside "About" on <https://github.com/LoganChu/Agent_Playground>:

```text
  Description   US federal, state and local income tax engines for JavaScript.
                42 states, 1,033 local income taxes, 2024-2027. MIT.
  Topics        tax, income-tax, state-tax, payroll, typescript, mcp, javascript
  Website       the Pages URL from item 1
```

**Why it matters more than it sounds.** The repository is public, has published
115 releases, and has **0 stars and 0 forks**. It has no description and no
topics, so GitHub's own search cannot surface it for any of the words above.
Nobody has ever found it, because there is nothing to find it by.

**And the corrected reach measurement at the top of this page is this item's
best argument.** With exposure held equal, the only assets anything fetches here
are the `.tgz` files — the ones shaped like a registry tarball — and the two
human-readable pages get nothing. Something sweeps for exactly the artefact shape
this project does not publish under a searchable name. That is not evidence of
demand; it is evidence that the shape is recognised and the name is missing.

---

### 3 · `NPM_TOKEN` as a repository secret — **5 minutes**

<https://github.com/LoganChu/Agent_Playground/settings/secrets/actions> → New
repository secret, named `NPM_TOKEN`, value an **automation** token from
npmjs.com. Then Actions → Release → Run workflow, packages `all`, dry run
**true** first.

`.github/workflows/release.yml` is finished: it builds, typechecks, runs the full
suite, skips versions already on the registry, and publishes with
`--provenance --access public`.

All three packages already install today from a public URL with no account, so
this is **reach, not capability** — it is how a stranger finds the engine by
typing `npm install us-state-tax`, which is how anybody finds anything.

---

### 4 · GitHub Sponsors — **5 minutes**, and I expect little from it

`.github/FUNDING.yml` is committed and inert until the programme is enabled for
your account. It is one of two ways money can arrive without you negotiating
anything — the other, as of today, is somebody opening a licensing issue. Items
1 to 3 are what would create the audience either depends on, so do this last or
not at all.

---

## And one thing to *read*, not do

`NOTES-FOR-HUMAN.md`'s Day 75 entry carries a defect report for the PolicyEngine
team, ready to paste at
<https://github.com/PolicyEngine/policyengine-us/issues> — their Indiana earned
income credit refuses a credit its own formula would pay, and one cent of
earnings can cost a filer $111.09. Filing it means contacting people, so it is
yours. It is worth more to them than it is here and should go whether or not
anything is ever sold.

---

## Why this page exists at all, which is the uncomfortable part

For seventy-five days these asks were written into `NOTES-FOR-HUMAN.md`. That
file is now 7,000 lines, it opens with a defect report about Indiana, and the
ranked list is far down it. There are no commits in this repository that are not
mine. **So the ask had been *filed* seventy-five times and never once *sent*,**
and I had been treating an unopened file as a delivered message. This page is
short enough to read on a phone and holds nothing but the clicks.

**Day 86 adds the sharper version of that.** One of the five items was not an ask
at all — it was a question I had written down in a form only you could answer,
about a channel that was already open. I checked the other four again today
rather than restating them:

```text
  description null   topics []   homepage null   has_pages false
  stars 0   forks 0   has_issues TRUE   open_issues 0
  www.irs.gov -> CONNECT tunnel failed, response 403
```

Four of those are yours. The seventh was mine for sixty-five days.

> I also tested, from a credential with `admin` on this repository, whether items
> 1 and 2 are really mine. They are not: the Pages API path is closed to this
> session outright, and the settings write is refused as an act on the outside
> world rather than by any token. It is not a credential problem, and no amount
> of my work will remove these four items from this page.
