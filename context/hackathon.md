# Sparkl — Hackathon Compliance

> Meta Global AI Developer Hackathon, run by Meta + Cerebral Valley.
> Sources: [event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon),
> [details guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) (verified 2026-10-27),
> [Meta event page](https://dev.meta.ai/events/global-hackathon).

## Key Facts

- **Build window:** Oct 27 – Nov 4, 2026. Submissions due **Nov 4, 9:00 PM ET** via the [CV submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). Judging Nov 5–8.
- **Prizes:** $1M total. Indie $400K (150/100/75/50/25K). Startups $550K (250/150/75/50/25K). Bonus $50K (Viral $20K, Open-weights $10K, Community $10K, Agentic $5K, Creative $5K).
- **Tracks:** Indie Developer and Startups. Every project enters exactly one track.
- **Themes:** Build for Your World or Push the Frontier.
- **Must build with Meta's models:** Muse Spark series, Muse Wonder, Muse Image, Muse Voice Transcribe, SAM 3.1 via the [Meta Model API](https://dev.meta.ai/products/meta-model-api), open-weights Muse Glimmer and Muse Spark Open, plus the Muse Code coding agent.
- **Judging rubric (verified):** Impact 30%, Use of Meta AI Tooling 25%, Technical Depth & Execution 20%, Demo 25%. Stage 1 pass/fail on theme fit + Meta tooling use. Top 5 per track to finals.

## Schedule (ET, verified)

- Oct 26 12:00 PM: Kickoff.
- Oct 27 12:00–1:00 PM: Agents 101.
- Oct 28 12:00–1:00 PM: Agents 102.
- Oct 30 12:00–1:00 PM: Fireworks + Muse Open Models.
- Weekdays during build: Discord office hours 10–11 AM ET.
- Nov 3: last full day for submission questions.
- Nov 4 9:00 PM: submissions due + final office hours.
- Nov 9 12:00 PM: closing ceremony, top 10 + winners. Nov 16: community vote winner.
- Livestream: [live page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/live). Community: [Discord connect](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/discord).

## Rules (verified)

- Repos must be public. Max 4 per team, solo allowed.
- Demo must only highlight features built during the hackathon.
- New work only; startups may build on existing code but must flag what is new.
- Banned: policy violations or unlicensed code/data; avoid generic anti-projects (medical advice, basic RAG, simple image analyzers, education chatbots, job screeners, nutrition, personality/sports coaches, political/war).

## Submission (verified)

- One submission per team by the Representative via the portal.
- Requires public repo, accessible 3-minute demo video, live product, all members listed.
- Late submissions not considered.

## Resources (verified)

- Meta $150 API credits: [claim form](https://docs.google.com/forms/d/e/1FAIpQLScam78z7tHsNYibiFyJQVFzEgr0coyBTiY568SxxNbsPa3jiw/viewform) — **submitted**. Claim by Nov 4 9:00 PM ET, credit card required for pre-auth. Docs: [overview](https://dev.meta.ai/docs/overview), [quickstart](https://dev.meta.ai/docs/quickstart), [models](https://dev.meta.ai/docs/models).
- Baseten $100 + 2M TPM (up to 2,000 participants): [request form](https://docs.google.com/forms/d/e/1FAIpQLSfM7gcK8yMZEmAGq6DbTyiuv2c71IH7CKCy0fXGIfUED1qxVQ/viewform). Use `meta-models/muse-spark-open-1026` for the hackathon.
- Modal $100 (first 1,000 participants): [request form](https://docs.google.com/forms/d/e/1FAIpQLSe_GDPtLZsdA57xPhFcOCi_yLjPf8HRxMIQJ5V7ystoKSqWCQ/viewform).
- Fireworks $25 (select teams): [request form](https://docs.google.com/forms/d/e/1FAIpQLSdPQTTES8_nhavzZkOrebVNYbM1FumWLdpeZx8ZSNe4QLXKPA/viewform).

## Our Entry

- Track: Startup — judged on technical execution and whether it holds up in production. The demo must hold up, not just look good.
- Theme: Build for Your World — Meta models inside a cleaning marketplace.
- Primary Meta AI integration: the job-post assistant (Muse Spark), with saved answers that improve with use, shipped. Smart match explanations were cut for time; they are the next integration if there is room.

## Meta AI Candidates for Sparkl

1. **Smart match explanations (Muse Spark):** "why this cleaner / job" summaries on ranked suggestions. Directly strengthens our headline feature.
2. **Job-post assistant (Muse Spark):** draft the cleaning checklist and price hint from address + notes. Demo-friendly.
3. **Chat assist (Muse Spark):** suggested replies plus EN↔ES auto-translation in the job thread. Ties into the i18n story.
4. **Photo check (SAM 3.1):** before/after job photos segmented for completeness. Highest wow, highest risk.

Pick one as the primary scored integration; a second only if time allows.

## Open Questions

- [x] Official Rules: judging criteria and weights verified from details guide.
- [x] Submission format verified (portal, public repo, 3-min video, live product).
- [x] Track and theme confirmed (Startup / Build for Your World).
- [x] Confirm eligibility (jurisdiction, no Meta/CV affiliation) — confirmed by participant.

## Comments on the Models

**Issues**: 
- Working on the sandbox is difficult for testing new skill, libraries and autonomy testing.
- find and fixing issue take a long time.
- Issues installing Nodejs and pnpm inside the sandbox. it took a lot of tokens

**Features**:
- Muse Code CLI. I like the way it keeps clear visualization on the task or job it is working on.
- I used Muse Image to create a sample pics and some icons and the result was pretty impressive. i like so far.