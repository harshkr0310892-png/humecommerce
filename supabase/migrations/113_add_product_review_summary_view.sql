create or replace view public.product_review_summary as
select
  pr.product_id,
  count(*)::int as review_count,
  coalesce(avg(pr.rating)::numeric(10,2), 0)::numeric(10,2) as avg_rating
from public.product_reviews pr
group by pr.product_id;

grant select on public.product_review_summary to anon, authenticated;
