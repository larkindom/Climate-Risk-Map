# Climate Risk & Housing Map

A React map overlaying FEMA climate hazard risk on Redfin housing market
data across the 20 largest U.S. metros, testing an actual question rather than
just displaying data: **is climate risk showing up in home prices yet, or
is the market not pricing it in?**

## Stack

React, Vite, Tailwind CSS, `react-map-gl` on MapLibre GL JS. No backend, no
API keys, no billing risk — same choice as this repo's sibling project,
[NYC-Electrification-Map](../NYC-Electrification-Map): MapLibre (a fully
open-source fork of Mapbox GL JS) with CARTO's free Dark Matter basemap
instead of Mapbox, so there's no token to manage and no usage-based cost to
watch.

## Data sources

Three free, keyless datasets, joined by county (FIPS):

| Dataset | Source | Role |
| --- | --- | --- |
| National Risk Index (Counties) | FEMA, live ArcGIS Feature Service (`services.arcgis.com/.../National_Risk_Index_Counties/FeatureServer/0`) | County polygon, population, and per-hazard *projected* risk fields for flood, wildfire, heat wave, and hurricane |
| County Market Tracker | Redfin Data Center, public S3 (`redfin-public-data.s3-us-west-2.amazonaws.com/redfin_market_tracker/county_market_tracker.tsv000.gz`) | Monthly median sale price, YoY change, price/sqft, inventory, and days on market, all residential property types |
| NFIP Claims | OpenFEMA, live REST API (`www.fema.gov/api/open/v2/FimaNfipClaims`) | Individual flood-insurance claim records — actual *realized* flood losses, to compare against FEMA NRI's projections |

All three were queried/downloaded live and field-checked while building
this. **A fourth source, Census ACS county income data, was evaluated and
dropped** — its bulk county API now requires a signup-gated key, which
isn't something a pipeline can self-serve. NFIP claims were chosen instead:
still keyless, and thematically sharper (realized losses vs. projected
risk, not just another demographic column).

**Zillow and Redfin's per-listing APIs are not publicly available** (Zillow's
is enterprise-only, Redfin has none) — this is why the project works at
county-market granularity via Redfin's aggregate Data Center exports instead
of individual properties.

**Redfin's `REGION` field doesn't follow one consistent naming rule.**
Louisiana counties are legally "parishes" (`"Orleans Parish, LA"`, not
`"Orleans County, LA"`) and D.C. has neither (`"District of Columbia, DC"`)
— both would break a name derived programmatically from the county name.
Every target county is instead matched by its exact Redfin region string
via the `data-pipeline/seeds/target_counties.csv` seed, verified against a
live download.

## Data pipeline

`data-pipeline/` is a small bronze → silver → gold ELT pipeline (DuckDB +
dbt), not a single fetch script — the point being that a join across three
sources should be inspectable and tested, not "trust me it worked."

```
data-pipeline/
├── extract/                 # bronze: dumb fetch-and-cache, zero transformation
│   ├── fetch_fema_nri.py    # → .cache/fema_nri.geojson
│   └── fetch_nfip_claims.py # → .cache/nfip_claims.json (paginated, ~32 requests)
├── seeds/target_counties.csv  # FIPS ↔ Redfin region name ↔ display label
├── models/
│   ├── staging/       # one model per source, cast/rename only
│   ├── intermediate/  # per-source aggregation (this is the actual silver-layer work)
│   └── marts/         # counties_gold — the final joined, one-row-per-county table
├── tests/              # + models/marts/schema.yml
└── export/export_geojson.py  # counties_gold -> public/data/counties.geojson
```

Redfin needs no extractor at all — DuckDB reads the cached `.tsv.gz`
directly via `read_csv()`, so the bronze layer for that source is just the
cached file itself. FEMA and NFIP need Python because they're paginated
JSON APIs, but those scripts only fetch and cache raw responses; every cast,
join, and aggregation happens afterward in SQL.

The actual transformation work lives in `models/intermediate/`:
`int_nfip_claims_by_county.sql` aggregates 316,316 raw claim records down to
one summary row per county (claim count, total paid, per-capita), and
`int_redfin_latest_by_county.sql` replaces what used to be a Python loop
("keep the trailing 60 months") with a window function and an `array_agg`.

**Tests** (`dbt test`, 9 checks) are the actual data-quality guarantee behind
the join, not just documentation: `unique`/`not_null` on the county FIPS key,
`not_null` on the hazard and NFIP-claim-count columns (a null claim count
would mean a target county silently matched zero NFIP records — worth
flagging, not defaulting to zero), and a singular test asserting
`counties_gold` has exactly 20 rows, which is what would actually catch a
county getting dropped by one of the joins.

Run it:

```bash
cd data-pipeline
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python3 extract/fetch_fema_nri.py
python3 extract/fetch_nfip_claims.py
dbt seed --profiles-dir .
dbt run --profiles-dir .
dbt test --profiles-dir .
python3 export/export_geojson.py   # regenerates ../public/data/counties.geojson
```

`profiles.yml` lives inside `data-pipeline/` and is only ever invoked with
`--profiles-dir .`, so this project never touches `~/.dbt/profiles.yml`.
`dbt docs generate --profiles-dir . && dbt docs serve --profiles-dir .`
brings up the live lineage graph and column-level docs for all six models.

## Counties

The core/principal county of each of the top 20 U.S. metros by population
(OMB metro definitions), not a hand-picked set — so the risk-vs-price read
isn't cherry-picked toward disaster-prone metros:

| County | Metro | County | Metro |
| --- | --- | --- | --- |
| New York County, NY | New York | Suffolk County, MA | Boston |
| Los Angeles County, CA | Los Angeles | San Francisco County, CA | San Francisco |
| Cook County, IL | Chicago | Riverside County, CA | Riverside |
| Dallas County, TX | Dallas–Fort Worth | Wayne County, MI | Detroit |
| Harris County, TX | Houston | King County, WA | Seattle |
| District of Columbia | Washington | Hennepin County, MN | Minneapolis |
| Philadelphia County, PA | Philadelphia | San Diego County, CA | San Diego |
| Fulton County, GA | Atlanta | Hillsborough County, FL | Tampa |
| Miami-Dade County, FL | Miami | Denver County, CO | Denver |
| Maricopa County, AZ | Phoenix | St. Louis County, MO | St. Louis |

Where a metro spans multiple counties (e.g. Dallas–Fort Worth, Riverside–San
Bernardino), the single most populous or principal-city county stands in for
the metro. Adding more counties is a one-line row in
`data-pipeline/seeds/target_counties.csv` plus the matching FIPS in each
`extract/*.py` script's target list, then a rerun of the pipeline.

## Climate Risk Score

`calculateClimateRisk()` in `src/lib/scoring.js`, 0-100, computed
client-side from the raw FEMA fields (the data pipeline only fetches and
joins — no score is baked into `counties.geojson`, same split as the
reference project's `socrata.js`/`scoring.js`).

**This deviates from FEMA's own composite Risk Index score, deliberately.**
FEMA's per-hazard `*_RISKS` field is Expected Annual Loss in dollar terms,
which scales with total exposure — a county's population and building
value — not with hazard likelihood or severity per se. A live pull for this
project returned a `RISKS` composite of **99.7 for King County, WA**, chosen
as a lower-risk contrast case, on par with Miami-Dade's 99.6 — not because
Seattle faces comparable climate hazards, but because it's a large,
high-value county and EAL scales with dollars at risk regardless of per-unit
risk. `*_ALR_NPCTL` (Annualized Loss Rate, National Percentile) is a loss
**rate** — already normalized by exposure — so every hazard component in the
score reads from `*_ALR_NPCTL` instead. With that field, King County lands
in the 30-55th percentile range across hazards: still not risk-free (Pacific
Northwest flooding and wildfire smoke are real), but genuinely lower than
the Gulf Coast counties, which is what the raw composite failed to show.

Score is a weighted average of each hazard's applicable percentile:

- **Flood 30%** — `max(coastal, inland)` annualized loss rate percentile
- **Wildfire 25%**
- **Heat wave 25%**
- **Hurricane 20%**

Hazards FEMA returns as `null` for a given county (e.g. hurricane risk for
Denver or King County — no Gulf/Atlantic coastal exposure) are excluded
from both the weighted sum and the weight total, rather than treated as
zero. This is the same "applicable criteria only" principle as the
reference project's `calculateReadiness()`: excluding a hazard that
structurally doesn't apply keeps a non-coastal county from being penalized
for information that was never going to exist for it.

Color is a continuous green → yellow → red gradient (`scoreToColor()` in
`scoring.js`, sampled at every 5 points for the map's fill layer) rather
than a 3-color step scale. With all 20 launch counties landing in FEMA's
"moderate" 30-70 band on the ALR_NPCTL scale, a 3-step scale painted the
whole map the same orange — a continuous gradient keeps differences within
that band visible instead of flattening them.

## The actual insight: risk vs. price

The bottom-left chart plots each county's Climate Risk Score against its
most recent year-over-year median sale price change. It's a small,
fixed-N=20 scatter — not a statistical claim — but the point of building it
this way rather than just listing stats: do the highest-risk counties show
any sign of cooler price growth, or does climate risk currently look
invisible to buyers? Click a chart point or a county on the map; both
select the same county and open its detail panel.

## Setup

```bash
npm install
npm run dev
```

`public/data/counties.geojson` is checked in, so the frontend runs standalone
without needing the pipeline. To regenerate it (refresh housing figures,
add a county, etc.), run the full sequence in **Data pipeline** above. No
env vars or API keys anywhere in this project.

## Deploy to GitHub Pages

```bash
npm run deploy
```

Builds and pushes `dist/` to the `gh-pages` branch (via the `gh-pages`
package). Enable Pages on that branch in the repo's Settings → Pages. The
Vite `base` path in `vite.config.js` is set to `/Climate-Risk-Map/`
to match this repo's GitHub Pages URL.
