# Integrate Baseten into the app for job creation

I want to integrate Baseten model to help user to post a job. instead of filling the form, it will be a chat like interface where they guide it to the questions for the post. at the end the will review and summit the form

for the location use a google map library or API to locate the address. also use the map for the cleaner profile service area

## thinks to consider

- This is a pay model so use a local first for testing, when the feature is done so a test with the real one.
- Use `context\archive\baseten-prompt.md` to connect the model from Baseten
- ask any necessary question
- update this file as need it
- add the plan into this document
- add this to the tasks when the plan is approve
- update context files with the result of this implementation

## Plan

Status: approved by the owner on 2026-10-29. Tasks are in
`context/tasks.md` §10.

### Decisions (owner, 2026-10-29)

1. **Baseten path:** shared Model APIs (pay per token), not the dedicated
   816B deployment in `context/archive/baseten-prompt.md`. That path is
   blocked (no B200:8 access) and costs ~$80/hour with a warm replica, so
   the $100 credit would last ~75 minutes.
2. **Hackathon story:** the project is built with Muse Code, and the
   in-app job-post assistant is a real tool-using agent on Muse Spark Open
   (aims at the Agentic bonus). Smart match explanations stay as a later
   phase that is cut first if time runs out.
3. **Maps:** OpenStreetMap for the hackathon. Geocoding and map tiles sit
   behind a provider switch so Google can replace them in production
   without touching screens or services.
4. **03 overlap:** the map lat/lng idea and the cleaner-profile single
   save CTA from `03-improvements-issues.md` are folded into this feature.
   The rest of 03 stays in 03.
5. **Assistant scope:** collect every field, suggest a price, draft a
   cleaning checklist into the notes, and learn from use so later sessions
   ask fewer, better questions. Two shortcuts the owner asked for:
   - a host with only one property is never asked for the address; the
     assistant confirms it in passing ("At 12 Ocean St as usual?");
   - a host who always uses the same cleaner is asked "Go with Maria as
     always?". Until two-way assignment (03) lands, "yes" pins that
     cleaner to the top of the job's suggestions and says so. With 03, it
     becomes a real offer the cleaner accepts.
6. **Voice:** hosts can speak their answers (Muse Voice Transcribe).
7. **Voice key:** try the existing `META_MODEL_IMAGE_API_KEY`; the owner
   has no other key.

### Verified Facts (2026-10-29)

- `BASETEN_API_KEY` in `.env` works: `GET inference.baseten.co/v1/models`
  returned 200.
- `meta-models/muse-spark-open-1026` is listed: $1.25 / M input tokens,
  $4.25 / M output. Features: `tools`, `json_mode`, `reasoning`, text and
  image input. It does **not** support `structured_outputs`, so every
  model output is checked against Zod on our side.
- A live JSON-mode extraction turn ("this Friday 10am to 1pm at 12 Ocean
  St, Bondi, 2 bed") returned the correct draft (`2026-10-30`,
  `10:00`–`13:00`) in 1.8s, using ~650 tokens (~$0.002 per turn).
- With a 400-token cap and default reasoning, all the tokens went to
  reasoning and the content was empty (`finish_reason: length`). The client
  must send `reasoning_effort: "low"` and a budget of about 1500 tokens.
- Local `muse-glimmer:latest` (Ollama, OpenAI-compatible `/v1`, tools
  capability) gave the same correct draft for the same prompt, but took
  56s on a cold start. It is good enough for local development, too slow
  for e2e.
- `META_MODEL_IMAGE_API_KEY` covers every Meta Model API model. Calling
  `GET api.meta.ai/v1/models` (Bearer auth) returned 200 and lists
  `muse-voice-transcribe-1.0`, `muse-spark-1.3`, `muse-image-1.0`,
  `sam-3.1` and `muse-wonder-1.0`.
- Voice transcription works:
  - Endpoint: `POST https://api.meta.ai/v1/asr/transcribe`.
  - Multipart body with two parts:
    - `request` (JSON):
      `{"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","sampleRate":16000}`
    - `audio`: the WAV file.
  - Only `"WAV"` was accepted (`wav`, `PCM16` and `LINEAR16` were
    rejected). Third-party docs say 16-bit mono at 16 or 24 kHz, up to
    10 minutes or 32 MB.
  - An 8.3s TTS clip came back as
    `{"transcript":"I need a turnover clean this Friday from 10 to 1 at 12 Ocean Street, Bondi. ...","audioDurationMs":8320}`
    in about 1.7s. Listed price: about $0.18 per audio hour.
- **Voice format gap:** the browser's `MediaRecorder` produces
  WebM/Opus, and on Android `expo-audio` records AAC/3GP. Neither is WAV.
  Planned fixes:
  - Web: decode with `AudioContext` and write 16 kHz PCM WAV in plain TS
    (no dependency).
  - iOS: `expo-audio` can record linear PCM WAV directly.
  - Android: needs a server-side conversion (for example `ffmpeg-static`,
    a large dependency) or the realtime WebSocket endpoint. Decided in P3;
    if neither fits, voice ships on web and iOS only.

### Goal

The Post tab becomes a guided chat. Hosts type or speak, and a Muse Spark
agent fills in the job draft, finds the address on a map, suggests a price
and a checklist, and remembers the host's past jobs. The host always reviews
the pre-filled form and submits it. The model never posts a job.

### Success Criteria

- A host can post a job entirely through the assistant, by text or by
  voice, ending on the pre-filled review form, then submit through the
  existing `validatePostJob` → `jobs.create` path.
- "Use the form instead" is always available and keeps the draft. The form
  path keeps working when the model is down.
- Address entry uses OSM autocomplete plus a map pin on Post Job, and a pin
  plus radius on the cleaner service area. The raw lat/lng text fields are
  gone from both screens.
- The cleaner profile has one save button for service area and
  availability.
- A returning host is offered "same as last time" details (address, window,
  size, checklist). The assistant asks fewer questions in the next session
  when fields were corrected in the past.
- Changing between `local`, `baseten` and `fake` needs only an env change.
- `pnpm verify` stays green and coverage stays at or above 80%. The new
  assistant e2e suite passes against the fake model. One manual run against
  real Baseten passes, after owner approval.

### Approach

**Ground rule: the model only fills a draft.** It never creates jobs,
never makes up coordinates or prices, and everything it returns is parsed
with a strict Zod schema before use.

Backend (all logic in services, routers stay thin):

- `services/llm.ts`: an OpenAI-compatible chat-completions client built on
  `fetch`, with no new dependency. Config: `LLM_BASE_URL`, `LLM_MODEL`,
  `LLM_API_KEY`, `LLM_MODE` (`live` | `fake`).

  | Mode | Server | Model |
  | ---- | ------ | ----- |
  | Local | `http://localhost:11434/v1` (Ollama) | `muse-glimmer:latest` |
  | Real | `https://inference.baseten.co/v1` | `meta-models/muse-spark-open-1026` |
  | Fake | scripted turns | used by unit tests and e2e |

  Every call sets `reasoning_effort: "low"`, caps output tokens and uses a
  20s timeout. The fake mode can only be enabled in test or development.
- `services/job-assistant.ts`: the agent loop. Each turn sends the
  transcript, the current draft, today's date and the host's memory. The
  model may call tools, with at most 6 tool steps per turn. Each tool's
  arguments are Zod-checked and each tool is a plain service function:
  - `update_draft(patch)`: merges into the draft; strict schema, so fields
    like `hostId`, `status` or `price` are rejected.
  - `geocode_address(text)`: returns candidates from the geo service. The
    model picks one, and the coordinates come from the geocoder only.
  - `get_host_history()`: the host's recent jobs (addresses, windows,
    sizes, checklists, prices) for "same as last time".
  - `suggest_price(sizeSqm, lat, lng)`: a deterministic median of
    comparable jobs nearby, falling back to a rate per m² in the weights
    config. The model only words the hint; the host sets the final price.

  The service works out the missing fields and `readyForReview` itself
  rather than trusting the model. If the model replies without valid JSON
  or tool calls, it gets one repair retry; after that the turn returns a
  typed error and the UI offers the form with the draft kept.
- **Learning:** a new `assistant_sessions` table (Drizzle migration):
  host id, job id (if posted), fields the model filled, fields the host
  changed on the review form, turns, tool calls, outcome (`posted` /
  `abandoned` / `fell_back`), model, latency and tokens. **No message
  text is stored.** On read, the service turns this into:
  - per-host memory (combined with the host's past jobs) that pre-fills
    the next session;
  - correction rates per field, added to the prompt as hints (for example,
    "hosts often correct `windowEnd`, confirm it explicitly"). Across
    hosts only aggregates are used, never another host's data;
  - shortcuts, worked out by the service (not the model) and passed to
    the prompt as facts:
    - `singleProperty`: exactly one distinct property in the host's jobs.
      The address is pre-filled, and the model is told to confirm it, not
      ask for it.
    - `usualCleaner`: the same cleaner completed at least 3 of the host's
      last 5 completed jobs, with no review from the host below 4 stars.
      The model offers "go with {name} as always?".

  Without a properties table (see Open Items), "property" means one
  distinct geocoded address. No fine-tuning.
- `services/geo.ts`: a provider interface with `autocomplete`, `geocode`
  and `reverse`. The OSM provider uses Photon (komoot) for search-as-you-
  type and Nominatim for geocode and reverse. Requests are debounced and
  cached on the server, at most 1 per second, with an identifying
  `GEO_USER_AGENT`, as Nominatim's policy requires. A Google provider can
  be added later under `GEO_PROVIDER=google`.
- `services/voice.ts`: Muse Voice Transcribe through the Meta Model API.
  Audio arrives as base64 in the request body, capped at ~30s / 1.5 MB, and
  is never stored. Key: `META_MODEL_API_KEY`.
- Routers: `jobAssistant.turn` and `jobAssistant.finish` (records the
  review-form diff and the outcome), `geo.autocomplete` / `geocode` /
  `reverse`, `voice.transcribe`.
- **Guardrails:**
  - per-user rate limits on assistant, geo and voice calls;
  - the transcript is held by the client and capped in turns and
    characters;
  - message bodies and addresses are never logged, only metadata (model,
    latency, tokens, tool names);
  - every key is server-only. The only public value is the tile URL.

Shared (`packages/shared`): `jobDraftSchema` (the Post form's string
fields), `assistantTurnInput` / `assistantTurnOutput`, the
`assistantFinishInput` diff, `geoPlaceSchema` and `transcribeInput`.

Frontend:

- **Post tab:** `AssistantChat` (bubbles that reuse the chat thread styles,
  quick-reply chips, a mic button, a typing indicator) beside a live draft
  summary card. "Review" opens the existing form pre-filled with the
  `AddressMapPicker`. "Use the form instead" is always shown. Logic goes in
  `providers/job-assistant.ts`, with tests.
- **`AddressMapPicker`:** autocomplete field, map and draggable pin;
  reverse-geocodes when the pin is dropped.
  - Native: `react-native-maps`, which is bundled in Expo Go, with an OSM
    `UrlTile`. Moving to Google later is a provider flag.
  - Web: `leaflet` + `react-leaflet` in a `.web.tsx` file.
  - The © OpenStreetMap contributors attribution is always visible.
- **`ServiceAreaMapPicker`:** a pin plus a radius circle and slider, on the
  cleaner profile. Service area and availability then share one Save
  button (from 03).
- **Voice:** `expo-audio` (works in Expo Go) on native, `MediaRecorder` on
  web. The transcript lands in the composer for the host to edit before
  sending.
- Every string goes through `packages/i18n`. New colours, radii or shadows
  go into `design.md` first.

New dependencies, one line each:

- `react-native-maps`: native map, already bundled in Expo Go.
- `leaflet` + `react-leaflet`: web map, since `react-native-maps` has no
  web support.
- `expo-audio`: microphone recording in Expo Go.

### Steps

Phases are ordered by what gets cut last. Deadline: Nov 4, 9 PM ET.

**P0 — Spike (no merge):**

1. Tool calling on Muse Spark Open (Baseten) and Glimmer (Ollama) with the
   four tool definitions.
2. `react-native-maps` + OSM `UrlTile` on RN 0.88 in Expo Go; `react-leaflet`
   on Expo web.
3. Muse Voice Transcribe endpoint, audio formats, and whether the current
   Meta key covers it.

**P1 — Core:**

4. Shared contracts.
5. LLM client with live and fake modes, plus env entries (`.env.example`).
6. Geo service (OSM provider, cache, rate limit) and router.
7. Job-assistant agent loop with the `update_draft` and `geocode_address`
   tools, and its router.
8. Post tab assistant UI and the pre-filled review form with
   `AddressMapPicker`.
9. Cleaner `ServiceAreaMapPicker` and the single save button.

**P2 — Smart:**

10. `assistant_sessions` migration and `jobAssistant.finish`.
11. `get_host_history`, correction-rate prompt hints, and `suggest_price`.
12. Checklist drafting into the notes.

**P3 — Voice:**

13. Voice service and router, the mic button, and the transcript in the
    composer.

**P4 — Stretch (cut first):**

14. Smart match explanations on ranked suggestions.

**Close-out:**

15. e2e: a new `assistant.spec.ts` against the fake model; update
    `forms.spec.ts` and the happy path for the map picker, with geo mocked
    in e2e.
16. Real Baseten run (paid). Run only after the owner approves the exact
    command.
17. Docs:
    - `project.md`: scope and demo script;
    - `architecture.md`: new services and routers, the provider switches,
      SSE not WebSocket, and removing the "no implementation exists"
      banner;
    - `design.md`: assistant and map screens;
    - `hackathon.md`: Our Entry;
    - `code-standard.md` and `AGENTS.md`: stale banners;
    - `README.md`, `tasks.md`, `CHANGELOG.md`.

### Validation Plan

- Unit tests, with no network:
  - `services/llm.ts`: request shape, timeout, reasoning-budget handling;
  - `job-assistant`: merges, rejection of bad model output, the injection
    case (a model patch carrying `hostId` or `status` is rejected), the
    tool-step cap, missing-field calculation, "this Friday" resolution;
  - `geo`: fake fetch, cache, rate limit;
  - `suggest_price`: comparables and fallback;
  - learning: correction-rate maths;
  - frontend provider helpers.
- `pnpm verify` green, with coverage at or above 80%.
- `pnpm --filter @sparkl/frontend e2e` green, including the new assistant
  suite.
- Manual:
  - one local Glimmer session end to end;
  - Expo Go device pass on the map and microphone;
  - one approved Baseten run, with tokens and latency recorded.

### Risks

| Risk | Mitigation |
| ---- | ---------- |
| `react-native-maps` / `react-leaflet` incompatible with RN 0.88 / React 19.3 | P0 spike first. Fallback: Leaflet in `react-native-webview`. |
| Spark Open tool calls unreliable on Baseten | JSON-mode loop with the same Zod contract (already verified working). |
| OSM public endpoints throttle the demo | Server cache, debounce, 1 req/s, identifying User-Agent; the provider switch allows a quick change. |
| Glimmer too slow locally | Fake mode for e2e and tests; Glimmer for manual development only. |
| Voice endpoint or key not available | P3 is cut on its own; text chat is unaffected. |
| Scope against 6 days | Strict phase order; P4 then P3 are cut first. |

### Open Items

- ~~Does `META_MODEL_IMAGE_API_KEY` cover Muse Voice Transcribe?~~ Yes,
  verified 2026-10-29 (see Verified Facts). In code it is read as
  `META_MODEL_API_KEY`, falling back to `META_MODEL_IMAGE_API_KEY`.
- How Android audio becomes WAV (see the voice format gap above). Decided
  in P3.
- **Properties table (03 New Ideas).** Hosts would manage properties in
  their own tab and pick one when posting. That changes 02:
  - the address map picker moves to the property form;
  - the assistant gets a `list_properties` tool instead of
    `geocode_address` for returning hosts;
  - `singleProperty` becomes a simple count.

  Owner decision needed: build properties inside 02 P1, or ship 02 with
  addresses on each job and move to properties in 03. Until decided, P1
  keeps the address on the job.
- **Usual cleaner as a real assignment** depends on 03's two-way
  assignment (host offers, cleaner accepts). Until then it is a pinned
  suggestion only.
