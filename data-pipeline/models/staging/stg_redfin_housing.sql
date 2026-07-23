-- Staging: Redfin Data Center county market tracker, filtered down from
-- ~230MB/millions of rows to just the 20 target counties' "All Residential"
-- monthly rows. DuckDB reads the cached .tsv.gz directly via read_csv() —
-- no separate Python load step, the file itself is the bronze layer.
--
-- Redfin's REGION field doesn't map to a FIPS code or follow one naming
-- rule (Louisiana uses "Parish", D.C. has neither "County" nor "Parish"),
-- so the join to stcofips goes through the target_counties seed rather
-- than deriving a FIPS code from the region string.

with raw as (
    select
        REGION as redfin_region,
        PROPERTY_TYPE as property_type,
        PERIOD_END as period_end,
        try_cast(MEDIAN_SALE_PRICE as double) as median_sale_price,
        try_cast(MEDIAN_SALE_PRICE_YOY as double) as median_sale_price_yoy,
        try_cast(MEDIAN_PPSF as double) as median_ppsf,
        try_cast(INVENTORY as double) as inventory,
        try_cast(MEDIAN_DOM as double) as median_dom
    from read_csv(
        '{{ env_var("REDFIN_TRACKER_PATH", ".cache/county_market_tracker.tsv000.gz") }}',
        delim='\t', header=true, quote='"'
    )
    where PROPERTY_TYPE = 'All Residential'
)

select
    counties.stcofips,
    raw.period_end,
    raw.median_sale_price,
    raw.median_sale_price_yoy,
    raw.median_ppsf,
    raw.inventory,
    raw.median_dom
from raw
inner join {{ ref('target_counties') }} as counties
    on raw.redfin_region = counties.redfin_region
