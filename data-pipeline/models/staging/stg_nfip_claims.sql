-- Staging: raw NFIP flood insurance claims (316k rows across 20 counties),
-- cast/renamed only — aggregation happens in int_nfip_claims_by_county.

select
    "countyCode" as stcofips,
    "yearOfLoss" as year_of_loss,
    coalesce(try_cast("amountPaidOnBuildingClaim" as double), 0) as amount_paid_building,
    coalesce(try_cast("amountPaidOnContentsClaim" as double), 0) as amount_paid_contents
from read_json_auto('{{ env_var("NFIP_CLAIMS_PATH", ".cache/nfip_claims.json") }}')
