create or replace view public.seller_review_summary as
select
  s.id as seller_id,
  s.name as seller_name,
  s.email as seller_email,
  count(distinct p.id)::int as product_count,
  coalesce(sum(prs.review_count), 0)::int as review_count,
  coalesce(
    case
      when coalesce(sum(prs.review_count), 0) > 0 then
        sum(prs.avg_rating * prs.review_count) / sum(prs.review_count)
      else 0
    end,
    0
  )::numeric(10, 2) as avg_rating,
  bp.best_product_id,
  bp.best_product_name,
  bp.best_product_avg_rating,
  bp.best_product_review_count
from public.sellers s
left join public.products p on p.seller_id = s.id
left join public.product_review_summary prs on prs.product_id = p.id
left join lateral (
  select
    p2.id as best_product_id,
    p2.name as best_product_name,
    coalesce(prs2.avg_rating, 0)::numeric(10, 2) as best_product_avg_rating,
    coalesce(prs2.review_count, 0)::int as best_product_review_count
  from public.products p2
  left join public.product_review_summary prs2 on prs2.product_id = p2.id
  where p2.seller_id = s.id
  order by
    coalesce(prs2.review_count, 0) desc,
    coalesce(prs2.avg_rating, 0) desc,
    p2.created_at desc
  limit 1
) bp on true
group by
  s.id,
  s.name,
  s.email,
  bp.best_product_id,
  bp.best_product_name,
  bp.best_product_avg_rating,
  bp.best_product_review_count;

grant select on public.seller_review_summary to anon, authenticated;
