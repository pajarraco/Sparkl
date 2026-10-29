# Assistant that learns from use

The price hint and the usual-cleaner suggestion are examples of things the
agent should learn as hosts keep asking questions. Instead of hard-coding
each one, keep a table where the AI saves solutions and reads them back in
later conversations. Each solution keeps a record of how often it is used and
how well it works, so the most valuable answer is proposed first.

## Plan

Status: **approved by the owner on 2026-10-29.** Tasks are in
`context/tasks.md` §12.

### Decisions (owner, 2026-10-29)

1. **Deadline:** L1 ships before the Nov 4 demo, ahead of 02 P4 (match
   explanations, cut first). 02 P3 voice stays in plan.
2. **Stored text:** only the answer the assistant produced for the form is
   stored, never the host's messages and never personal data. There is no
   free-text `trigger` column: matching uses the solution's kind and tags
   from a closed list (below). Every save passes a personal-data check,
   including the host's own.
3. **Sharing:** solutions are shared across hosts, and **the host's own
   data always comes first**. Sharing is in L1, not L2.
4. **Feedback:** votes come from the host's response, meaning the "Use
   this" / "Not this" chips on a proposal and whether the host kept the
   proposal on the review form when posting. The model never votes.

### Recommendation in one paragraph

Add a **solutions store**: one table of reusable answers, each with a kind,
tags, a scope (this host or every host), a structured payload, and usage and
feedback counters. The agent gets two tools: `find_solutions` reads the
best-ranked matches, and `save_solution` stores a new candidate. **Ranking is
based on the host's response, not repetition.** An answer the host taps "Not
this" on, or changes on the review form, sinks. A rarely used answer that
hosts keep rises. The price hint and the usual cleaner stay as computed
tools, because numbers and ids must come from data, never from memory. The
store learns *whether and how* to offer them.

### What changes from today

| Today (02 P2) | With the solutions store |
| ------------- | ------------------------ |
| `suggest_price`, `usualCleaner` and `singleProperty` are rules written in code. | They stay in code as **facts** (computed from jobs). The store records whether each host accepts them, so a host who always ignores the price hint stops being shown it. |
| A checklist is drafted from scratch by the model every time. | The host's own accepted checklist is proposed first, then the best-ranked shared checklists. |
| Correction hints are counted per field (`assistant_sessions`). | The same review-form diff feeds solution feedback, so every proposal gets a score. |
| Questions about the product ("do I supply products?") get a model guess. | Answers come from owner-seeded FAQ entries only. The model never invents policy. |

### Data model (Drizzle migration `0003_assistant_solutions`)

`assistant_solutions`

| Column | Notes |
| ------ | ----- |
| `id` | uuid |
| `scope` | `host` or `global` |
| `host_id` | the owner of a `host` solution; null for `global` |
| `kind` | closed list in `packages/shared` (below) |
| `tags` | text array from the closed `SOLUTION_TAGS` list (for example `turnover`, `deep_clean`, `pets`, `linen`, `studio`, `large_home`); GIN index |
| `payload` | JSON, checked against the Zod schema for its `kind` on every write **and** read |
| `fingerprint` | hash of the normalised payload, so the same checklist saved by many hosts is counted as one global solution |
| `source` | `model`, `service` or `seed` |
| `status` | `candidate`, `active` or `retired` |
| `proposed`, `accepted`, `rejected` | counters (from the events table) |
| `score` | cached ranking score, recomputed when an event lands |
| `last_accepted_at`, `created_at`, `updated_at` | timestamps |

`assistant_solution_events`: `solution_id`, `session_id`, `host_id`, `event`
(`proposed` / `accepted` / `rejected`), `at`. This is the audit trail behind
the counters. A unique key on (`solution_id`, `session_id`, `event`) gives
one vote per session. Distinct `host_id`s are counted for sharing.

**Kinds** (each has a strict Zod payload):

| Kind | Payload | Who may write it | Scope |
| ---- | ------- | ---------------- | ----- |
| `checklist` | up to 12 items, each at most 80 characters | model (candidate), seed | host; global once shared (below) |
| `window_preference` | weekday, start, end | model | host only (a schedule, not useful to others) |
| `offer_preference` | which computed offer (`price_hint`, `usual_cleaner`) the host accepts or ignores | service | host only |
| `faq` | question (at most 160 characters), answer (at most 600) | seed only | global |

Access notes are **not** a kind. They often hold lockbox codes, which counts
as personal data under decision 2.

### Personal-data check (every save)

A save is rejected before it is stored when any text in the payload
contains:

- an email address, a phone number, a URL or a run of 4 or more digits
  (codes, street numbers);
- a street address: a word from a street-type list (`St`, `Street`, `Rd`,
  `Ave`, …) next to a number;
- the name of the host, or of any cleaner they have worked with (the
  service already holds both from host memory).

It is a pure function with its own tests. A rejected save tells the model to
retry without personal details. Nothing is logged except the kind and the
reason code.

### Agent tools (added to the 02 loop, same rules: Zod on every argument)

- `find_solutions(kind, tags)` returns up to 3 active solutions: **the
  host's own first**, then global, each ordered by score, preferring more
  tag overlap. Results go back as **quoted data in a tool result**, never
  into the system prompt, capped at 1,500 characters. Each proposal is
  logged as a `proposed` event and returned to the client with its id, so
  the UI can show the chips.
- `save_solution(kind, tags, payload)` stores a **host-scope candidate**
  after the personal-data check. Only the kinds the model may write are
  accepted, with at most 3 saves per session. The model can never create a
  global row, an FAQ entry, or anything the service owns.
- New shared field on `assistantTurnOutput`: `proposals` (id, kind and a
  short label), so the chat can show "Use this" / "Not this" under each one.

### Feedback (the host's response, recorded by the service)

- **Chip tap** (new `jobAssistant.feedback` mutation, host-only, the session
  must be the caller's and still open): `accepted` or `rejected` at once.
- **At `jobAssistant.finish`**, for each proposal with no chip vote:
  - **posted** and the target field (notes, window, price, pin) was kept as
    proposed: `accepted`;
  - **posted** and the host changed that field on the review form:
    `rejected`;
  - **abandoned** or **fell_back**: no vote.

A host-scope candidate becomes `active` the first time it is accepted. Three
rejections in a row retire it.

### Sharing across hosts (L1)

- When a host-scope `checklist` is accepted, the service looks up its
  `fingerprint` as a global row and creates or updates it.
- The global row turns `active` once **3 different hosts**, each with at
  least one posted job, have accepted the same fingerprint. One person
  cannot promote an entry from a single account.
- Global votes count once per host, so a host repeating their own checklist
  does not inflate it.
- **Host priority:** `find_solutions` always returns the host's own matches
  before any global one, and a global row the host rejected is never
  proposed to that host again.
- The owner can retire any global row with a CLI script
  (`pnpm --filter @sparkl/api solutions:retire <id>`), since the admin panel
  is out of scope.

### Ranking

`score = wilsonLowerBound(accepted, accepted + rejected) × recency`

- The Wilson lower bound (95%) means 9 of 10 beats 1 of 1, so one lucky
  vote cannot top the list.
- `recency` halves every 30 days since the last acceptance, so stale
  answers fade.
- `proposed` (repetition) breaks ties and is reported, but on its own never
  raises a score. An answer shown often and rejected often sinks.
- The constants (confidence, half-life, top-k, caps, sharing threshold) go
  in `SOLUTION_RANKING_CONFIG` next to the ranking weights in
  `packages/shared`.

### Guardrails

- **Memory poisoning:** a host could try to save "ignore your rules…" as a
  checklist item. Payloads are structured and capped, they pass the
  personal-data check, and they are only read back as quoted tool data,
  never as instructions. A shared entry needs 3 different real hosts to
  accept it, and the owner can retire it.
- **Facts stay computed:** prices, coordinates and cleaner ids always come
  from services. A solution can only choose which tool to offer or what
  text to propose.
- **Privacy:** no message text and no personal data, on any save (decision
  2). Window and offer preferences never leave the host's scope.
- **Limits:** the per-host save cap and the existing assistant rate limit;
  logs carry ids, kinds and counts only.

### Steps (L1, before Nov 4, about 2 days)

1. Shared: kinds and payload schemas, `SOLUTION_TAGS`, the
   `SOLUTION_RANKING_CONFIG`, `proposals` on the turn output, and the
   `assistantFeedbackInput` schema.
2. Pure services with tests: ranking (Wilson, recency, host-first ordering),
   the personal-data check, payload fingerprinting.
3. Migration `0003_assistant_solutions` and a store for both tables.
4. `find_solutions` and `save_solution` in the agent loop, plus `proposed`
   events.
5. Feedback: `jobAssistant.feedback` for chip taps, and accept / reject from
   the review-form diff in `finish`.
6. Sharing: fingerprint → global row, the 3-distinct-hosts rule, and the
   retire script.
7. Wire the 02 price hint and usual-cleaner offer into `offer_preference`.
8. UI: "Use this" / "Not this" chips under proposals (i18n strings,
   `design.md` first if any style is new).
9. Seed: 3 obviously-fake global checklists and 3 FAQ entries, so the demo
   shows ranking on the first run.

### Later (not in L1)

- A host can view and clear their learned solutions.
- `price_adjustment` (learn a host's habit, for example "always rounds to
  $10"), worked out by the service from price edits.
- Embeddings (pgvector) only if tag matching misses too often.

### Validation plan

- Unit (no network):
  - payload schemas per kind;
  - the personal-data check (email, phone, URL, digits, address, known
    names), with both passing and failing cases;
  - Wilson and recency maths, and host-first ordering;
  - write permissions per kind and source, and the save cap;
  - one vote per session and once per host for global rows;
  - the 3-distinct-hosts sharing rule;
  - a globally shared row the host rejected is never proposed to them
    again;
  - cross-host isolation: host A never reads host B's `host` rows;
  - feedback mapping from chips and from the review-form diff.
- e2e (fake model): session 1 saves a checklist, taps "Use this" and posts;
  session 2 proposes it first. A checklist with a phone number is refused.
- Metrics from `assistant_sessions` before and after: questions per posted
  job, turns per session, the `fell_back` rate, and the acceptance rate of
  proposals.

### Risks

| Risk | Mitigation |
| ---- | ---------- |
| Deadline (Nov 4) with 02 P3 and close-out, plus 03 D and E, still open | L1 only; P4 is cut first; steps 8 and 9 can shrink to the chips alone. |
| Shared answers poisoned by one person | 3 distinct hosts with posted jobs, structured payloads, quoted data only, owner retire script. |
| The personal-data check misses something | Conservative patterns (any run of 4 or more digits fails); shared rows need 3 hosts; the owner can retire. |
| Rankings look random with little data | Seeded fake entries; the Wilson bound keeps one-vote entries low. |
| A review-form edit made for another reason counts as a rejection | Chip votes take precedence; field-level match only; abandoned sessions do not vote. |
