#!/usr/bin/env python3
"""
Bronze extractor: pages through OpenFEMA's NFIP claims dataset for the 20
target counties, verbatim, to .cache/nfip_claims.json.

Keyless, public API — confirmed live at
https://www.fema.gov/api/open/v2/FimaNfipClaims. ~316k claim records across
the 20 counties; paginated at 10,000/request (~32 requests). $select is kept
to the handful of fields the pipeline actually uses, since the full claims
schema has 40+ fields per row and this is a bronze-layer raw pull, not the
whole dataset.

Same "dumb fetch and cache" role as fetch_fema_nri.py — all aggregation
(claim counts, totals per county) happens in dbt's int_nfip_claims_by_county
model, not here.
"""

import json
import sys
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

CACHE_DIR = Path(__file__).parent.parent / ".cache"
OUTPUT_PATH = CACHE_DIR / "nfip_claims.json"

NFIP_CLAIMS_URL = "https://www.fema.gov/api/open/v2/FimaNfipClaims"

TARGET_COUNTY_CODES = [
    "36061", "06037", "17031", "48113", "48201", "11001", "42101", "13121",
    "12086", "04013", "25025", "06075", "06065", "26163", "53033", "27053",
    "06073", "12057", "08031", "29189",
]

SELECT_FIELDS = ["state", "countyCode", "yearOfLoss", "amountPaidOnBuildingClaim", "amountPaidOnContentsClaim"]
PAGE_SIZE = 10000


def build_url(skip):
    fips_list = ",".join(f"'{c}'" for c in TARGET_COUNTY_CODES)
    odata_filter = f"countyCode in ({fips_list})"
    params = (
        f"$select={','.join(SELECT_FIELDS)}"
        f"&$filter={quote(odata_filter)}"
        f"&$top={PAGE_SIZE}"
        f"&$skip={skip}"
    )
    return f"{NFIP_CLAIMS_URL}?{params}"


def fetch_page(skip):
    req = Request(build_url(skip), headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=60) as resp:
        return json.load(resp)


def main():
    if OUTPUT_PATH.exists():
        print(f"NFIP claims: using cached {OUTPUT_PATH}", file=sys.stderr)
        return

    all_claims = []
    skip = 0
    while True:
        page = fetch_page(skip)
        claims = page.get("FimaNfipClaims", [])
        all_claims.extend(claims)
        print(f"NFIP claims: fetched page at skip={skip} ({len(claims)} rows, {len(all_claims)} total)", file=sys.stderr)
        if len(claims) < PAGE_SIZE:
            break
        skip += PAGE_SIZE
        time.sleep(0.2)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(all_claims))
    print(f"NFIP claims: wrote {len(all_claims)} rows to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
