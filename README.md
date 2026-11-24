# Our Show

Find something we all want to watch.

Our Show is a mobile-first proof of concept for choosing a familiar show or channel together. The [product vision](docs/product-vision.md), [implementation handoff](docs/implementation-handoff.md), and [mockups](docs/mockups) describe the family experience.

## Run locally

From the repository root, run `python3 -m http.server 8000` and open [localhost:8000](http://localhost:8000/). The same relative paths work when GitHub Pages serves the repository root. The app uses plain HTML, CSS, and JavaScript and loads its catalog and artwork locally.

## Try the family flow

1. Choose your services and save a few familiar shows or channels. Search looks across the sample catalog.
2. Open a title on the Shelf to set each viewer’s preference and watch progress. Use Household settings to rename or add viewers.
3. In Tonight, choose who’s watching, pass on a suggestion, or pick it for the evening. Undo restores the most recent pass. Reopening a pick brings back the suggestions and passes for that night.

Household services, shelf entries, viewer preferences, and Tonight decisions are stored in this browser. Tonight starts a new decision on the next local calendar day. Clear the site’s browser storage to try onboarding again. The [legacy fixture](fixtures/legacy-shows.json) is available for future migration.

Streaming labels are illustrative. Review the supplied prototype artwork before a public release. Icons are from [Lucide](artwork/icons/LICENSE).
