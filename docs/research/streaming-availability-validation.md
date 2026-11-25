# U.S. streaming availability validation

On November 25, 2026, the [authenticated Vercel preview smoke test](https://vercel.com/teal9/our-show-vfo3/81ZQUSGNLCVEoW9JRrVTp4z3nQAp) used the repository’s server-held TMDB token to query the U.S. TV provider directory and each series’ regional offers. The credential stayed in Vercel. The build command used to collect this evidence was temporary. To repeat the check from a server with `TMDB_READ_ACCESS_TOKEN` configured, run `node scripts/check-tmdb-provider-samples.mjs`.

## Direct U.S. tiers

| Household selection | Live TMDB TV directory entries |
| --- | --- |
| Netflix | `8` Netflix, `1796` Netflix Standard with Ads |
| Prime Video | `9` Amazon Prime Video, `2100` Amazon Prime Video with Ads |
| Disney+ | `337` Disney Plus |
| Hulu | `15` Hulu |
| Paramount+ | `2303` Paramount Plus Premium, `2616` Paramount Plus Essential |

The live U.S. directory omitted the historical Paramount+ ID `531`, so the allowlist omits it. The directory identified `10` as Amazon Video, `613` as Amazon Prime Video Free with Ads, `582` as Paramount+ Amazon Channel, `1853` as Paramount Plus Apple TV channel, `633` as Paramount+ Roku Premium Channel, and `293` as PBS Kids Amazon Channel. Those IDs and the Netflix Kids profile (`175`) are outside the direct-tier allowlist. Paid ad-supported tier IDs qualify only in `flatrate`.

## Sanitized offer results

The sample links point to the same series and explicit locale returned by TMDB. IDs shown below are the provider IDs in each returned offer category. A dash means the category was absent.

| Series and regional Watch link | `flatrate` | `buy` | `free` | `ads` |
| --- | --- | --- | --- | --- |
| [Bluey, 82728, US](https://www.themoviedb.org/tv/82728-bluey/watch?locale=US) | 337, 257, 2528, 508 | 10, 2, 3, 7 | 486 | 2621 |
| [Puffin Rock, 69926, US](https://www.themoviedb.org/tv/69926-puffin-rock/watch?locale=US) | 8, 175, 1796 | 10, 2, 3 | — | — |
| [Tumble Leaf, 65047, US](https://www.themoviedb.org/tv/65047-tumble-leaf/watch?locale=US) | 9, 2100 | — | 9 | — |
| [PAW Patrol, 57532, US](https://www.themoviedb.org/tv/57532-paw-patrol/watch?locale=US) | 8, 257, 2303, 2616, 2383, 1853, 582, 175, 633, 1796, 1890, 2415 | 10, 2, 3, 7 | 9, 486 | — |
| [Daniel Tiger’s Neighborhood, 40050, US](https://www.themoviedb.org/tv/40050-daniel-tiger-s-neighborhood/watch?locale=US) | 2528, 293 | 10, 2, 3, 7 | 212, 2796 | — |
| [Bluey, 82728, GB control](https://www.themoviedb.org/tv/82728-bluey/watch?locale=GB) | 337, 38 | 2, 10 | — | — |
| [Only Murders in the Building, 107113, US](https://www.themoviedb.org/tv/107113-only-murders-in-the-building/watch?locale=US) | 337, 15 | — | — | — |

No sample had a `rent` category. The GB control contained BBC iPlayer (`38`), which was absent from the U.S. result.

- Disney+ lists **Bluey**, Netflix lists **Puffin Rock**, and Prime Video’s U.S. title page advertises a Prime trial for **Tumble Leaf**. [Disney+](https://www.disneyplus.com/whats-on/entity-fa6973b9-e7cf-49fb-81a2-d4908e4bf694) · [Netflix](https://www.netflix.com/title/80044965) · [Prime Video](https://www.primevideo.com/detail/0JSOQNXC38YDDVGBXDDTIMFZS7?tr=us)
- Netflix and Paramount+ list **PAW Patrol**. Base Prime was `free` only in the live result, which resolves the discrepancy with the historical `flatrate` export for this smoke test. The Amazon purchase and Paramount+ channel use distinct IDs and are excluded. [Netflix](https://www.netflix.com/title/80026226) · [Paramount+](https://www.paramountplus.com/shows/paw-patrol/episodes/) · [Amazon purchase](https://www.primevideo.com/detail/0Q5UL6L8CMKIJ89JDN1HV5BOSR) · [Amazon channel](https://www.primevideo.com/detail/0SS4HSRBLYH73XQGVW11UU6ZCL)
- PBS KIDS lists **Daniel Tiger’s Neighborhood** for free. The Amazon purchase and PBS KIDS add-on leave the direct-service hint unknown. [PBS KIDS](https://www.pbs.org/parents/shows/daniel) · [Prime Video](https://www.primevideo.com/detail/0R6XJMK7HOB2VAON7NEZGZANG7?tr=us)
- Hulu confirms **Only Murders in the Building**. TMDB also returns Disney+, while Disney describes the U.S. listing as Hulu on Disney+ for bundle subscribers. The app suppresses the disputed Disney+ match for this title and keeps the validated Hulu match. [Hulu](https://www.hulu.com/series/only-murders-in-the-building-ef31c7e1-cd0f-4e07-848d-1cbfedb50ddf) · [Disney+](https://www.disneyplus.com/explore/articles/only-murders-in-the-building-tv-show-season-5-coming-soon)

This validates provider IDs and sampled series listings. Signed-in playback, household entitlement, episode coverage, and TMDB’s upstream refresh interval remain unverified.
