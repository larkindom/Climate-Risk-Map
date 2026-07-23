#!/usr/bin/env python3
"""
Bronze extractor: pulls the 20 target counties from FEMA's National Risk
Index ArcGIS Feature Service, verbatim, to .cache/fema_nri.geojson.

This is intentionally dumb — fetch and cache raw data, no cleaning or
transformation. dbt's stg_fema_nri model reads this file directly via
read_json_auto() and does the actual casting/renaming in SQL.
"""

import json
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

CACHE_DIR = Path(__file__).parent.parent / ".cache"
OUTPUT_PATH = CACHE_DIR / "fema_nri.geojson"

FEMA_NRI_QUERY_URL = (
    "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/"
    "National_Risk_Index_Counties/FeatureServer/0/query"
)

TARGET_STCOFIPS = [
    "36061", "06037", "17031", "48113", "48201", "11001", "42101", "13121",
    "12086", "04013", "25025", "06075", "06065", "26163", "53033", "27053",
    "06073", "12057", "08031", "29189",
]

HAZARD_FIELDS = ["CFLD", "IFLD", "WFIR", "HWAV", "HRCN"]
OUT_FIELDS = ["STCOFIPS", "COUNTY", "STATEABBRV", "POPULATION"] + [
    f"{h}_{suffix}" for h in HAZARD_FIELDS for suffix in ("RISKS", "RISKR", "ALR_NPCTL")
]


def main():
    if OUTPUT_PATH.exists():
        print(f"FEMA NRI: using cached {OUTPUT_PATH}", file=sys.stderr)
        return

    stcofips_list = ",".join(f"'{f}'" for f in TARGET_STCOFIPS)
    params = {
        "where": f"STCOFIPS IN ({stcofips_list})",
        "outFields": ",".join(OUT_FIELDS),
        "f": "geojson",
    }
    req = Request(f"{FEMA_NRI_QUERY_URL}?{urlencode(params)}", headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=60) as resp:
        data = json.load(resp)

    features = data.get("features", [])
    print(f"FEMA NRI: fetched {len(features)}/{len(TARGET_STCOFIPS)} counties", file=sys.stderr)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data))
    print(f"FEMA NRI: wrote {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
