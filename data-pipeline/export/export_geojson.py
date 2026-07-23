#!/usr/bin/env python3
"""
Reads the counties_gold mart from the DuckDB warehouse dbt built and writes
public/data/counties.geojson — the same contract the frontend has always
consumed (a GeoJSON FeatureCollection, one Feature per county). This is the
only place geometry_json (raw GeoJSON text carried through unparsed by every
dbt model) actually gets interpreted.
"""

import datetime
import json
import sys
from pathlib import Path

import duckdb

PIPELINE_DIR = Path(__file__).parent.parent
WAREHOUSE_PATH = PIPELINE_DIR / "warehouse.duckdb"
OUTPUT_PATH = PIPELINE_DIR.parent / "public" / "data" / "counties.geojson"


def json_default(value):
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    raise TypeError(f"Not JSON serializable: {value!r}")


def main():
    con = duckdb.connect(str(WAREHOUSE_PATH), read_only=True)
    rows = con.execute("select * from counties_gold").fetchall()
    columns = [d[0] for d in con.description]

    features = []
    for row in rows:
        record = dict(zip(columns, row))
        geometry = json.loads(record.pop("geometry_json"))
        features.append({"type": "Feature", "geometry": geometry, "properties": record})

    geojson = {"type": "FeatureCollection", "features": features}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(geojson, default=json_default))
    print(f"Wrote {len(features)} counties to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
