-- Intermediate: aggregates 316k raw NFIP claim records down to one summary
-- row per county — the actual "silver layer" transformation this pipeline
-- exists to demonstrate: claim count, total paid, average claim, and a
-- per-capita figure (joined against FEMA's population) so a huge county
-- and a small one are comparable.

select
    claims.stcofips,
    count(*) as nfip_claims_count,
    sum(claims.amount_paid_building + claims.amount_paid_contents) as nfip_total_paid,
    avg(claims.amount_paid_building + claims.amount_paid_contents) as nfip_avg_claim_paid,
    min(claims.year_of_loss) as nfip_earliest_year,
    max(claims.year_of_loss) as nfip_latest_year,
    sum(claims.amount_paid_building + claims.amount_paid_contents)
        / nullif(fema.population, 0) as nfip_paid_per_capita
from {{ ref('stg_nfip_claims') }} as claims
left join {{ ref('stg_fema_nri') }} as fema on claims.stcofips = fema.stcofips
group by claims.stcofips, fema.population
