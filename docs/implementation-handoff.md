# Clean-slate implementation handoff

Source: [design issue #19](https://github.com/jsmithe/chatgpt-test/issues/19), [prototype PR #21](https://github.com/jsmithe/chatgpt-test/pull/21). Product vision is the primary design input. The prototype PR is reference material, not the implementation baseline.

## Design references
- [Tonight after a pass](mockups/puffin-rock-tonight.webp)
- [Split-vote reminder sheet](mockups/bluey-split-vote.webp)
- [Inline reminder](mockups/bluey-reminder.webp)

Reminder timing and vote thresholds are exploratory, not requirements.

## Architecture direction
For this POC, use plain HTML, CSS and vanilla JavaScript, local JSON and LocalStorage, with no framework, build tooling, backend or separate architecture phase. Keep files small and use a simple data model: household-level services and shared title/channel collection; stable viewer and title identities; per-viewer preferences and watch state; separate temporary Tonight decision state. Adding a title must not imply any viewer likes it. Unknown is not dislike. Briefly document the data model in the implementation PR; do not undertake a separate architecture exercise. Target static hosting on GitHub Pages initially; no live API secrets in the client.

## First vertical slice
- Empty household can select services (include Prime Video, Netflix, Paramount+, YouTube), browse artwork, search and add familiar titles/channels.
- Returning household opens Tonight directly. Shared preferences take precedence over illustrative provider labels; avoid presenting known dislikes as strong shared picks. Consider the actual participating viewers and distinguish uncertainty. Completed shows remain eligible for rewatch.
- Pass for tonight, undo a pass, choose a show, and reopen a confirmed decision. Do not mutate permanent preferences when passing or choosing.
- Multiple artwork images support horizontal swipe, active pagination dots and accessible position announcement; no dots for one image.
- Preserve legacy data through an explicit import/migration plan; do not automatically seed a real household with demo data. Keep discovery of new shows separate.
- Provider labels in catalog.json are illustrative, not verified availability. Artwork is prototype/design reference material; review rights before public release.

## Validation
Use deterministic fixtures and isolated browser storage. Use a focused browser smoke test of the core flow and lightweight checks of ranking and persistence where practical. Defer comprehensive automated tests, CI infrastructure and full legacy import implementation until after the couch test; keep the legacy fixture for future migration. The prototype reported 14 passing Node tests and a Chromium mobile walkthrough; these are not tests of this new app.

Couch test: start empty, gather a few familiar options, then try Tonight when the kids disagree. Observe whether an older option prompts recognition before the parent supplies a compromise. Record friction and whether a choice was made.

## Inputs
- catalog.json and artwork/: illustrative sample catalog and images from prototype PR #21.
- fixtures/legacy-shows.json: demo legacy-format migration fixture, not production data.
- docs/mockups/: original design studies.
