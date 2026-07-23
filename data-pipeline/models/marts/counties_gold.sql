-- Gold: one row per county, joining all three sources. This is the table
-- export_geojson.py reads to produce public/data/counties.geojson — column
-- names match what the frontend already expects (see the schema.yml tests
-- alongside this model for the guarantees backing this join: exactly 20
-- rows, no silently-dropped counties).

select
    fema.stcofips as "STCOFIPS",
    fema.county as "COUNTY",
    fema.state_abbrv as "STATEABBRV",
    fema.population as "POPULATION",
    counties.label,

    fema.cfld_risks as "CFLD_RISKS",
    fema.cfld_riskr as "CFLD_RISKR",
    fema.cfld_alr_npctl as "CFLD_ALR_NPCTL",
    fema.ifld_risks as "IFLD_RISKS",
    fema.ifld_riskr as "IFLD_RISKR",
    fema.ifld_alr_npctl as "IFLD_ALR_NPCTL",
    fema.wfir_risks as "WFIR_RISKS",
    fema.wfir_riskr as "WFIR_RISKR",
    fema.wfir_alr_npctl as "WFIR_ALR_NPCTL",
    fema.hwav_risks as "HWAV_RISKS",
    fema.hwav_riskr as "HWAV_RISKR",
    fema.hwav_alr_npctl as "HWAV_ALR_NPCTL",
    fema.hrcn_risks as "HRCN_RISKS",
    fema.hrcn_riskr as "HRCN_RISKR",
    fema.hrcn_alr_npctl as "HRCN_ALR_NPCTL",

    fema.geometry_json,

    case
        when housing.stcofips is not null then struct_pack(
            period_end := housing.period_end,
            median_sale_price := housing.median_sale_price,
            median_sale_price_yoy := housing.median_sale_price_yoy,
            median_ppsf := housing.median_ppsf,
            inventory := housing.inventory,
            median_dom := housing.median_dom
        )
    end as housing,
    housing.housing_trend,

    nfip.nfip_claims_count,
    nfip.nfip_total_paid,
    nfip.nfip_avg_claim_paid,
    nfip.nfip_paid_per_capita,
    nfip.nfip_earliest_year,
    nfip.nfip_latest_year

from {{ ref('stg_fema_nri') }} as fema
left join {{ ref('target_counties') }} as counties on fema.stcofips = counties.stcofips
left join {{ ref('int_redfin_latest_by_county') }} as housing on fema.stcofips = housing.stcofips
left join {{ ref('int_nfip_claims_by_county') }} as nfip on fema.stcofips = nfip.stcofips
