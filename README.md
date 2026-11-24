# Our Show

Find something we all want to watch.

Our Show is a mobile-first app for choosing a familiar TV show together. The family workflow follows the [product vision](docs/product-vision.md) and [implementation handoff](docs/implementation-handoff.md).

## Run locally

Use Node.js 24 and npm.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`. In your TMDB account, open **Settings → API** and copy the **API Read Access Token** into `TMDB_READ_ACCESS_TOKEN`. Use the read access token, without a `Bearer ` prefix.
3. Run `npm run dev` and open [localhost:3000](http://localhost:3000/).

Search uses the server-side TV search route. With no credential configured, the app still works with manual entries and saved shows. Keep `.env.local` private. The token is never needed in a `NEXT_PUBLIC_` variable.

Run `npm test` for focused search and household tests with mock TMDB responses. Run `npm run typecheck` for TypeScript checks, or `npm run build` and `npm start` to try a production build locally.

## Deploy to Vercel Hobby

1. Import this repository in Vercel with the **Next.js** framework preset, the repository root as the project root, and Node.js 24.
2. Add `TMDB_READ_ACCESS_TOKEN` in **Project Settings → Environment Variables**. Select Production and any Preview environments that should have search.
3. Deploy or redeploy after adding the variable. Confirm that **Add our shows** returns TV results on the deployment.

This version uses a server route and requires a Next.js host. GitHub Pages served the previous static version. Back up the existing household before switching hosts or retiring the old deployment.

## Keep an existing household

- **Same origin** (same scheme, host, and port). On first load the app copies a valid `our-show-v1` household into `our-show-v2` and leaves the original in place. Shelf IDs, viewer IDs, preferences, watch progress, service choices, and saved channels carry over. Passes and the confirmed pick carry over on the same local calendar day.
- **New origin**, such as GitHub Pages to Vercel. In the browser that holds the old household, open the original site and copy the **value** under **Developer Tools → Application (or Storage) → Local Storage → the original site's origin → `our-show-v1`**. Save it as a plain-text `our-show-backup.json` file. On the new site, choose **Restore household backup** on the welcome screen or in Household settings and select the file. The app asks before replacing an existing household.
- Use **Household → Download household backup** to save a current copy. An unreadable record stays in place and the app prompts for a valid backup before writing over it.

Backups contain household names and preferences. They stay in the browser unless you share the file yourself.

## Current scope

- A new household starts on **Add our shows**, with four familiar TV picks, search, and manual entry. Streaming service selection is optional in Household settings.
- Add TV series from TMDB search or enter a title manually. A search fetches the first English-language results page. The Shelf stores title details, artwork references, and stable TMDB IDs locally. Saved shows and manual entry work when TMDB search is unavailable, and an unavailable image falls back to the title.
- Search results show **Availability unknown**. Service choices are kept at the household level. Any labels on migrated sample titles are marked as sample data. There is no regional provider, subscription, or rental lookup.
- Search uses a short upstream timeout, a 15-minute server fetch cache, a per-client limit, and a per-instance limit. These limits are best effort on serverless instances.
- Tonight preferences and progress are per viewer. A pass or confirmed pick applies to the current local day. Household data is local to this browser, with no account or cloud sync.
- Existing YouTube channels can still appear on the Shelf and in Tonight. Channel search and adding channels are future enhancements.

This product uses the TMDB API but is not endorsed or certified by TMDB. [TMDB attribution](https://www.themoviedb.org/about/logos-attribution) · [Lucide icon license](public/artwork/icons/LICENSE)
