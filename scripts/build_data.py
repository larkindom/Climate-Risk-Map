#!/usr/bin/env python3
"""
Builds public/data/counties.geojson by joining two free, no-key datasets:

  1. FEMA National Risk Index (county polygons + per-hazard risk fields),
     queried live from FEMA's public ArcGIS Feature Service.
  2. Redfin Data Center's county market tracker (monthly housing stats),
     downloaded once from Redfin's public S3 bucket and cached locally
     (the file is ~230MB; scripts/.cache/ is gitignored).

Output holds only raw fields — no composite score. Scoring happens
client-side in src/lib/scoring.js, same as the reference NYC-Electrification-
Map project's socrata.js/scoring.js split.
"""

import csv
import gzip
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

SCRIPT_DIR = Path(__file__).parent
CACHE_DIR = SCRIPT_DIR / ".cache"
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "counties.geojson"

REDFIN_URL = (
    "https://redfin-public-data.s3-us-west-2.amazonaws.com/"
    "redfin_market_tracker/county_market_tracker.tsv000.gz"
)
REDFIN_CACHE_PATH = CACHE_DIR / "county_market_tracker.tsv000.gz"

FEMA_NRI_QUERY_URL = (
    "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/"
    "National_Risk_Index_Counties/FeatureServer/0/query"
)

# Primary/core county for each of the top 20 U.S. metros by population (OMB
# metro definitions, most populous or principal-city county per metro).
# Redfin's REGION field doesn't follow one consistent naming rule (Louisiana
# uses "Parish" instead of "County", D.C. has neither), so each is matched
# by exact string rather than derived from the county name programmatically
# — every string below was checked against a live download of the Redfin
# file, not guessed.
TARGET_COUNTIES = [
    {"stcofips": "36061", "label": "New York, NY", "redfin_region": "New York County, NY"},
    {"stcofips": "06037", "label": "Los Angeles, CA", "redfin_region": "Los Angeles County, CA"},
    {"stcofips": "17031", "label": "Chicago, IL", "redfin_region": "Cook County, IL"},
    {"stcofips": "48113", "label": "Dallas, TX", "redfin_region": "Dallas County, TX"},
    {"stcofips": "48201", "label": "Houston, TX", "redfin_region": "Harris County, TX"},
    {"stcofips": "11001", "label": "Washington, DC", "redfin_region": "District of Columbia, DC"},
    {"stcofips": "42101", "label": "Philadelphia, PA", "redfin_region": "Philadelphia County, PA"},
    {"stcofips": "13121", "label": "Atlanta, GA", "redfin_region": "Fulton County, GA"},
    {"stcofips": "12086", "label": "Miami-Dade, FL", "redfin_region": "Miami-Dade County, FL"},
    {"stcofips": "04013", "label": "Phoenix, AZ", "redfin_region": "Maricopa County, AZ"},
    {"stcofips": "25025", "label": "Boston, MA", "redfin_region": "Suffolk County, MA"},
    {"stcofips": "06075", "label": "San Francisco, CA", "redfin_region": "San Francisco County, CA"},
    {"stcofips": "06065", "label": "Riverside, CA", "redfin_region": "Riverside County, CA"},
    {"stcofips": "26163", "label": "Detroit, MI", "redfin_region": "Wayne County, MI"},
    {"stcofips": "53033", "label": "Seattle, WA", "redfin_region": "King County, WA"},
    {"stcofips": "27053", "label": "Minneapolis, MN", "redfin_region": "Hennepin County, MN"},
    {"stcofips": "06073", "label": "San Diego, CA", "redfin_region": "San Diego County, CA"},
    {"stcofips": "12057", "label": "Tampa, FL", "redfin_region": "Hillsborough County, FL"},
    {"stcofips": "08031", "label": "Denver, CO", "redfin_region": "Denver County, CO"},
    {"stcofips": "29189", "label": "St. Louis, MO", "redfin_region": "St. Louis County, MO"},
]

# Per-hazard fields to pull from FEMA NRI. RISKS is FEMA's raw Risk Index
# score (0-100) — but it's driven by Expected Annual Loss in dollar terms,
# which scales with total exposure (population/building value), not
# likelihood or severity per se. That makes it a poor cross-county
# comparison: in a live pull, King County, WA (chosen as a lower-risk
# contrast case) came back with a RISKS composite of 99.7, on par with
# Miami-Dade, purely because it's a large, high-value county. ALR_NPCTL
# (Annualized Loss Rate, National Percentile) is loss *rate* — already
# normalized by exposure — so it's what's actually used for scoring
# in-app. RISKS/RISKR are still pulled through for display/context.
HAZARD_FIELDS = ["CFLD", "IFLD", "WFIR", "HWAV", "HRCN"]
FEMA_OUT_FIELDS = ["STCOFIPS", "COUNTY", "STATEABBRV", "POPULATION"] + [
    f"{h}_{suffix}" for h in HAZARD_FIELDS for suffix in ("RISKS", "RISKR", "ALR_NPCTL")
]


def fetch_json(url, params):
    from urllib.parse import urlencode

    req = Request(f"{url}?{urlencode(params)}", headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_fema_nri():
    stcofips_list = ",".join(f"'{c['stcofips']}'" for c in TARGET_COUNTIES)
    params = {
        "where": f"STCOFIPS IN ({stcofips_list})",
        "outFields": ",".join(FEMA_OUT_FIELDS),
        "f": "geojson",
    }
    data = fetch_json(FEMA_NRI_QUERY_URL, params)
    features = data.get("features", [])
    print(f"FEMA NRI: fetched {len(features)}/{len(TARGET_COUNTIES)} counties", file=sys.stderr)
    return {f["properties"]["STCOFIPS"]: f for f in features}


def download_redfin_if_needed():
    if REDFIN_CACHE_PATH.exists():
        print(f"Redfin: using cached {REDFIN_CACHE_PATH}", file=sys.stderr)
        return
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Redfin: downloading {REDFIN_URL} (~230MB, one-time)...", file=sys.stderr)
    req = Request(REDFIN_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=300) as resp, open(REDFIN_CACHE_PATH, "wb") as out:
        while chunk := resp.read(1024 * 1024):
            out.write(chunk)
    print("Redfin: download complete", file=sys.stderr)


def fetch_redfin_housing():
    download_redfin_if_needed()
    target_regions = {c["redfin_region"]: c["stcofips"] for c in TARGET_COUNTIES}

    latest_by_county = {}
    trend_by_county = {c["stcofips"]: [] for c in TARGET_COUNTIES}

    with gzip.open(REDFIN_CACHE_PATH, "rt", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            if row.get("PROPERTY_TYPE") != "All Residential":
                continue
            stcofips = target_regions.get(row.get("REGION", "").strip('"'))
            if stcofips is None:
                continue

            period_end = row["PERIOD_END"]
            median_price = _to_float(row.get("MEDIAN_SALE_PRICE"))
            if median_price is not None:
                trend_by_county[stcofips].append({"period_end": period_end, "median_sale_price": median_price})

            current_latest = latest_by_county.get(stcofips)
            if current_latest is None or period_end > current_latest["PERIOD_END"]:
                latest_by_county[stcofips] = row

    for stcofips, trend in trend_by_county.items():
        trend.sort(key=lambda r: r["period_end"])
        # Keep the trailing ~5 years of monthly points for a sparkline.
        trend_by_county[stcofips] = trend[-60:]

    print(f"Redfin: matched {len(latest_by_county)}/{len(TARGET_COUNTIES)} counties", file=sys.stderr)
    return latest_by_county, trend_by_county


def _to_float(value):
    if value in (None, "", "NA"):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def build():
    fema_by_fips = fetch_fema_nri()
    redfin_latest, redfin_trend = fetch_redfin_housing()

    features = []
    for county in TARGET_COUNTIES:
        stcofips = county["stcofips"]
        fema_feature = fema_by_fips.get(stcofips)
        if fema_feature is None:
            print(f"WARNING: no FEMA NRI match for {county['label']} ({stcofips})", file=sys.stderr)
            continue

        redfin_row = redfin_latest.get(stcofips)
        if redfin_row is None:
            print(f"WARNING: no Redfin match for {county['label']} ({stcofips})", file=sys.stderr)

        properties = dict(fema_feature["properties"])
        properties["label"] = county["label"]
        properties["housing"] = (
            {
                "period_end": redfin_row["PERIOD_END"],
                "median_sale_price": _to_float(redfin_row.get("MEDIAN_SALE_PRICE")),
                "median_sale_price_yoy": _to_float(redfin_row.get("MEDIAN_SALE_PRICE_YOY")),
                "median_ppsf": _to_float(redfin_row.get("MEDIAN_PPSF")),
                "inventory": _to_float(redfin_row.get("INVENTORY")),
                "median_dom": _to_float(redfin_row.get("MEDIAN_DOM")),
            }
            if redfin_row
            else None
        )
        properties["housing_trend"] = redfin_trend.get(stcofips, [])

        features.append({"type": "Feature", "geometry": fema_feature["geometry"], "properties": properties})

    geojson = {"type": "FeatureCollection", "features": features}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(geojson))
    print(f"Wrote {len(features)} counties to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    build()
