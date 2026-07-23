-- Singular test: counties_gold must have exactly 20 rows (one per target
-- county). dbt singular tests fail if the query returns any rows, so this
-- returns a row only when the count is wrong — catching a county silently
-- dropped (or duplicated) by one of the joins, which none of the per-column
-- not_null/unique tests in schema.yml would otherwise catch.

select count(*) as county_count
from {{ ref('counties_gold') }}
having count(*) != 20
