---
author: Osito Wang
pubDatetime: 2026-07-22T00:00:00.000Z
title: "The URL is the database: how far can zero-backend go"
postSlug: urledger-url-as-database
featured: true
draft: false
tags:
  - JavaScript
  - Zero-Backend
  - Side-Project
  - Web
description: After a trip to Korea, someone posted a Splitwise invite in our group chat. Three months later, nobody had signed up and we just called it even. So I built an expense splitter where the entire ledger lives in the URL — no server, no accounts, nothing to join.
---

# The URL is the database: how far can zero-backend go

A while back a group of us traveled around Korea. The money side went the way it always goes: one person covered the barbecue place, someone else kept paying for taxis, somebody's card ate the shopping. At some point, one of us posted a Splitwise invite in the group chat: "everyone sign up and let's add the expenses."

Nobody signed up.

Not that week, not after we flew home. Three months later the invite was still sitting there, and by then the question had answered itself: the amounts were small, everyone shrugged, and we called it even. The debts weren't settled. They were _forgiven_ — because forgiving them was less work than registering and remembering.

That's the part that stuck with me. Splitwise works fine, and splitting the money was never the hard part. Signing up cost more than the debt was worth — the activation energy was higher than the balance.

Which suggests a design target: a split tool with zero activation energy. No app, no account, no ads, nothing to join — just add, update, share, settle.

## What if the link is the whole app

The answer I landed on: an expense splitter where the URL is the database. Not "the URL points to the database." The URL _is_ the database.

```
https://example.com/#s=y9gDcbLmVge3v1Tt...
```

Everything after `#s=` is the ledger — members, expenses, notes — serialized, compressed, base64'd. Open the link and the app decodes it and renders. There's no server round-trip; everything after the `#` never even leaves your browser (hash fragments aren't sent in HTTP requests, which is a nice privacy accident).

This sounds like a gimmick until you notice what it does to the group-chat workflow:

Sharing the ledger is just... sending a link, which is the one thing group chats are already good at. Nobody installs anything. Nobody registers. The person who opens your link sees the ledger instantly, and if they add the taxi they paid for, they send the updated link back.

I've started thinking of it as snapshot-and-fork, like git but for who-owes-whom. A shared link is an immutable snapshot. Opening it forks a copy. Sending it back is a merge (done by a human, in the chat, usually with the message "added the taxis").

The obvious objection is real-time sync — what if two people edit at the same time? My honest answer: I decided not to solve it. Real-time sync means a server, accounts, conflict resolution, and I'd be right back to building Splitwise. Passing an updated link back and forth more than ten times would get confusing, sure — but a small group settling one trip never gets there. And even for bigger groups the spending clusters around a few big items, so the number of rounds stays small. Whoever paid adds the expense and passes the link on. That matches how the chat already works, and it costs nothing to run.

(If your group genuinely needs concurrent editing, this tool is the wrong shape for you. PeerSplit does local-first P2P sync and it's neat — also much, much more code.)

## URLs explode, though

First version: `JSON → base64url`. Worked great for my three-person test ledger.

Then I generated a realistic one — 8 people, 30 expenses, the kind a two-week trip actually produces — and the URL came out to 6,194 characters. WhatsApp and WeChat start mangling links way before that. Not great!

The fix turned out to already be in the browser. `CompressionStream` has shipped everywhere since 2023, so you get deflate for free, no library:

```js
export async function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const deflated = await new Response(stream).arrayBuffer();
  return toBase64url(new Uint8Array(deflated));
}
```

Ledger JSON is extremely repetitive — the same eight names, the same keys, over and over — and deflate loves repetition. That 6,194-character monster compresses to 535. A normal dinner among four friends is around 160 characters, shorter than most tracking links.

Decoding tries decompression first and falls back to plain JSON, so links generated before compression still open. There's also a validation layer on decode (names must be unique, amounts must be positive integers, every payer has to actually exist in the member list) because "the URL is the database" also means "anyone can hand-craft a write to your database."

## The actual math (it's small)

I've buried the settlement algorithm this far down because honestly it's the least interesting part — but it is the part that makes the tool useful, so, briefly.

Netting: every expense turns into per-person balances. All money is integer cents, because floating-point money will eventually tell someone they owe $33.333333. When an amount doesn't divide evenly, the leftover cents go to participants in sorted-name order — arbitrary, but deterministic, so the same link computes the same result on every phone.

Settling: finding the true minimum number of transfers is NP-hard, which sounds scary until you realize a greedy pass — biggest debtor pays biggest creditor, repeat — settles n people in at most n−1 transfers and is optimal for basically any group that isn't adversarially constructed:

```js
while (creditors.length && debtors.length) {
  creditors.sort(byAmountDesc);
  debtors.sort(byAmountDesc);
  const c = creditors[0],
    d = debtors[0];
  const pay = Math.min(c.v, d.v);
  transfers.push({ from: d.name, to: c.name, amountCents: pay });
  c.v -= pay;
  d.v -= pay;
  if (c.v === 0) creditors.shift();
  if (d.v === 0) debtors.shift();
}
```

Eight people, thirty expenses: seven transfers. Circular debts (A owes B owes C owes A) cancel in the netting step before settlement even runs.

## Where this breaks

Things I gave up on purpose, so you don't have to discover them in the comments:

URLs have length limits. A compressed ledger with hundreds of expenses will eventually hit platform caps. For trips and dinners you're nowhere close; for a year of roommate expenses, maybe don't.

The link is the access control. Anyone holding the URL reads the ledger. Fine for "who paid for the barbecue," not fine for anything sensitive.

Merging is manual. If two people fork the same snapshot and both edit, a human reconciles. In an actual group chat this has yet to bite me, but I'm not going to pretend it can't.

## Prior art

Data-in-the-URL is not new — itty.bitty stuffed whole web pages into URLs back in 2018, and excalidraw and mermaid.live both carry document state in share links. The difference here is what's inside: not a read-only document but validated, editable, structured state, with the fork-and-relay workflow on top. Those tools use the URL to deliver a thing. Here the URL is the only place the thing exists.

## Closing

URLedger is about six hundred lines, no dependencies, nineteen tests. On a feature-comparison table against Splitwise it loses every single row, and that's fine — it exists to answer a narrower question: for splitting expenses among friends, do you actually need the server, the accounts, the sync?

For my group chat, so far: no.

The Korea trip never got settled. The next one is going to cost somebody exactly one click.

(Live demo: [a pre-filled trip ledger](https://pangmaowang.github.io/URLedger/#s=nc1BC4JAEIbhv7J85z1YWYS3rEMQBEG38DDWoAs5K-sGhvjfI6PCiAKvw_fO06DgImVXITpgcTZHhkbMAo1l7kwFjRUJIdHgumSp-L5sUNKVHaJXQoW9iF-y-ArRaB4GgUZJzpujKak7_nsv1jMibKxjEhXHO7T67TyanjIZD0b2VBvlrVpbyU7EPemZ9KxwHAzGFsalkioxWe7VqGd1yw9qOvsm_RS21hGnJBnapL0B) — the demo link is itself the entire demo ledger, because of course it is.)
