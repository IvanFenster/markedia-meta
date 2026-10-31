# Markedia

A marketplace for documented ideas. Someone writes up an idea they are not going
to build; the platform scores it, writes a public preview that describes it
without giving it away, and lists it for sale. Buyers get the full write-up.

Built for the Meta AI Developer Hackathon. Every model call runs on **Muse Spark
1.3** through the Meta Model API.

## How an evaluation works

One model, three passes:

| Step | What it does | Why this shape |
|---|---|---|
| **1. Research** | Grounded web search for products that already resemble the idea | Originality is a factual question, so it is answered from the live web rather than from memory. Uses the Responses API, the only endpoint with `web_search`. |
| **2. Score + preview** | Seven weighted criteria, a clarity rating, an abuse check, and the public preview | Output is pinned to a JSON Schema, so a malformed answer is rejected by the API rather than parsed hopefully. |
| **3. Heading** | Names the listing | Sees **only** the preview, never the idea, so it cannot leak what a buyer is paying for. |

Reasoning effort is set per step — `xhigh` for judging, `minimal` for naming —
because the three passes do very different amounts of thinking.

### Scoring

Originality 25% · Value Proposition 20% · Feasibility 15% · Problem-Solution Fit
10% · Ease of Launch 10% · Scalability 10% · Defensibility 10%.

Clarity is scored 1–5 and shown separately. It rates how clearly the idea is
*written*, not how good it is, and deliberately carries no weight.

### Not giving the idea away

The preview is the hard part of a marketplace like this: it has to be worth
reading and still leave something to buy. It is five short fields, only one of
which describes the idea, and the prompt names the specific problem as withheld
— for a sharp idea the problem is the solution inverted. The public heading is
written from the preview alone, so the leak surface stays in one place.

### Abuse check

Submitted text is treated as data, never as instructions. Each evaluation also
judges whether a submission is an attempt to game the marketplace — prompt
injection, demanding its own scores, dictating its own preview — and picks
reasons from a fixed list rather than writing its own. A flagged idea cannot be
published, enforced in the UI and by a database trigger.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres + RLS) ·
Meta Model API

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

Apply the SQL files in `supabase-*.sql` to a Supabase project, in the order
their header comments describe.
