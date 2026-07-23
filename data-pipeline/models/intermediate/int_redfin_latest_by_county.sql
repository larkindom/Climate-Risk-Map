-- Intermediate: collapses the monthly Redfin time series down to one row
-- per county — the latest month's snapshot, plus a trailing 5-year trend
-- array. Real SQL doing what the old build_data.py did in a Python loop
-- ("keep the trailing 60 rows"): a window function ranks each county's
-- rows by recency, and array_agg builds the trend array in one pass.

with ranked as (
    select
        *,
        row_number() over (partition by stcofips order by period_end desc) as rn
    from {{ ref('stg_redfin_housing') }}
),

latest_snapshot as (
    select
        stcofips,
        period_end,
        median_sale_price,
        median_sale_price_yoy,
        median_ppsf,
        inventory,
        median_dom
    from ranked
    where rn = 1
),

trend as (
    select
        stcofips,
        array_agg(
            struct_pack(period_end := period_end, median_sale_price := median_sale_price)
            order by period_end
        ) as housing_trend
    from ranked
    where rn <= 60
    group by stcofips
)

select
    latest_snapshot.stcofips,
    latest_snapshot.period_end,
    latest_snapshot.median_sale_price,
    latest_snapshot.median_sale_price_yoy,
    latest_snapshot.median_ppsf,
    latest_snapshot.inventory,
    latest_snapshot.median_dom,
    trend.housing_trend
from latest_snapshot
left join trend on latest_snapshot.stcofips = trend.stcofips
