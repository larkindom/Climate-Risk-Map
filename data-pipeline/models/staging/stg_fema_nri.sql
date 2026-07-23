-- Staging: FEMA National Risk Index, one row per county.
-- Reads the bronze cache directly (no separate load step) — DuckDB parses
-- the GeoJSON FeatureCollection into a typed struct, so this model is just
-- casting/renaming, no logic. geometry_json is carried through as opaque
-- JSON text; export_geojson.py is the only place it gets interpreted.

with raw as (
    select unnest(features) as f
    from read_json_auto('{{ env_var("FEMA_NRI_PATH", ".cache/fema_nri.geojson") }}')
)

select
    f.properties.STCOFIPS as stcofips,
    f.properties.COUNTY as county,
    f.properties.STATEABBRV as state_abbrv,
    f.properties.POPULATION as population,
    f.properties.CFLD_RISKS as cfld_risks,
    f.properties.CFLD_RISKR as cfld_riskr,
    f.properties.CFLD_ALR_NPCTL as cfld_alr_npctl,
    f.properties.IFLD_RISKS as ifld_risks,
    f.properties.IFLD_RISKR as ifld_riskr,
    f.properties.IFLD_ALR_NPCTL as ifld_alr_npctl,
    f.properties.WFIR_RISKS as wfir_risks,
    f.properties.WFIR_RISKR as wfir_riskr,
    f.properties.WFIR_ALR_NPCTL as wfir_alr_npctl,
    f.properties.HWAV_RISKS as hwav_risks,
    f.properties.HWAV_RISKR as hwav_riskr,
    f.properties.HWAV_ALR_NPCTL as hwav_alr_npctl,
    f.properties.HRCN_RISKS as hrcn_risks,
    f.properties.HRCN_RISKR as hrcn_riskr,
    f.properties.HRCN_ALR_NPCTL as hrcn_alr_npctl,
    to_json(f.geometry) as geometry_json
from raw
