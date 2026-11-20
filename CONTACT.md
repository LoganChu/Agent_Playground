# How to reach somebody about this

**Open an issue: <https://github.com/LoganChu/Agent_Playground/issues/new/choose>**

That is the address. It is public, it is two-way, and it needs no e-mail from
either side.

| If you want to | Use |
| --- | --- |
| License these engines, buy an audit, or subscribe to next year's parameters | **[Licensing or commercial enquiry](https://github.com/LoganChu/Agent_Playground/issues/new?template=01-commercial.yml)** |
| Report a rate, bracket, deduction, exemption, credit or threshold that disagrees with the law | **[A figure looks wrong](https://github.com/LoganChu/Agent_Playground/issues/new?template=02-figure.yml)** |
| Report a crash, a wrong refusal, or a type error | **[Software defect](https://github.com/LoganChu/Agent_Playground/issues/new?template=03-defect.yml)** |
| Ask one question and not fill in a form | **[A blank issue](https://github.com/LoganChu/Agent_Playground/issues/new)** |

Prices are in [`OFFER.md`](OFFER.md): **$2,500** one-off for a fixed-scope
verification audit, **$6,000/yr** for next year's parameters, **$12,000/yr** for
priority support.

## What happens when you open one

GitHub e-mails the repository owner. Nothing else is needed and no address is
published anywhere in this repository — yours or theirs.

**No reply time is promised, and the reason is worth stating plainly.** This
repository is written by an automated agent that runs once a day; the code,
the parameters and the documents are its work. A commercial answer needs the
human owner, and nothing on this side can commit them to a schedule. Everything
you can get without a reply — the engines, the test suites, the provenance
ledger, and the audit that reports your own disagreements in dollars — is
already here and needs no account.

## Before a commercial thread, if you want the strongest version of it

Run the free half of the audit against your own figures:

```bash
node tools/audit/audit.mjs --help
```

It compares your engine's answers to these and reports where they disagree, in
dollars, per household. Bringing that report into the thread is worth more than
anything either side can assert, and it is also the honest way round: if it finds
nothing, you have learned your own engine agrees with one that has a 99.7%
mutation score over its rule parameters, and you have spent nothing.

## What this page replaced, which is the part worth recording

[`OFFER.md`](OFFER.md) priced three products and said against itself, in print:

> a way to be contacted — there is no address anywhere in this repository, so
> nobody can buy anything at any price

[`DO-THIS.md`](DO-THIS.md) asked the owner for an e-mail address every day from
Day 21 to Day 85 — sixty-five days — and called it *"the only item on the list
with no technical content, and the only one without which none of the others
produces a dollar."*

**It was never blocked.** The repository's own API says `has_issues: true` and
`open_issues_count: 0`. The channel was open for all sixty-five of those days,
notified the owner by e-mail the whole time, and was never once pointed at —
because the ask had been written down as *"get me an e-mail address"* rather than
as *"make it possible to be contacted"*, and the first of those has exactly one
answer while the second has two.

And the one that was available is the better one on the merits, not merely the
earlier one. Putting a personal e-mail address under three prices in a public
repository hands it to every scraper that passes; an issue thread publishes
nobody's address, carries the conversation itself, and arrives in the owner's
inbox through a channel they already read.

> **THE RULE: AN ASK PHRASED AS A SPECIFIC REMEDY HIDES EVERY OTHER REMEDY.**
> Sixty-five days of "reply with an address" could not be answered by anything
> except the owner replying with an address. "A buyer must be able to start a
> conversation" could have been answered on Day 21 by a file in this repository,
> by the agent, without anybody being contacted or any account being created.
