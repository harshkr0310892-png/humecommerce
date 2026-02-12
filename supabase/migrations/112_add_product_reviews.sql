create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  description text not null,
  reviewer_name text,
  reviewer_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);
create index if not exists product_reviews_user_id_idx on public.product_reviews (user_id);
create index if not exists product_reviews_rating_idx on public.product_reviews (rating);

alter table public.product_reviews enable row level security;

create policy "Anyone can read product reviews"
on public.product_reviews
for select
using (true);

create policy "Authenticated users can create their own review"
on public.product_reviews
for insert
with check (
  auth.role() = 'authenticated'
  and auth.uid() = user_id
  and exists (
    select 1
    from public.customer_profiles cp
    where cp.user_id = auth.uid()
  )
);

create policy "Users can update their own review"
on public.product_reviews
for update
using (auth.uid() = user_id);

create policy "Users can delete their own review"
on public.product_reviews
for delete
using (auth.uid() = user_id);

drop trigger if exists update_product_reviews_updated_at on public.product_reviews;

create trigger update_product_reviews_updated_at
before update on public.product_reviews
for each row
execute function public.update_updated_at_column();

create table if not exists public.product_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_review_images_review_id_idx on public.product_review_images (review_id);

alter table public.product_review_images enable row level security;

create policy "Anyone can read product review images"
on public.product_review_images
for select
using (true);

create policy "Users can add images to their own review"
on public.product_review_images
for insert
with check (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.product_reviews pr
    where pr.id = review_id
      and pr.user_id = auth.uid()
  )
);

create policy "Users can delete images from their own review"
on public.product_review_images
for delete
using (
  exists (
    select 1
    from public.product_reviews pr
    where pr.id = review_id
      and pr.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('product-review-images', 'product-review-images', true)
on conflict (id) do nothing;

create policy "Anyone can view product review images"
on storage.objects for select
using (bucket_id = 'product-review-images');

create policy "Authenticated users can upload product review images"
on storage.objects for insert
with check (bucket_id = 'product-review-images' and auth.role() = 'authenticated');

create policy "Authenticated users can update product review images"
on storage.objects for update
using (bucket_id = 'product-review-images' and auth.role() = 'authenticated');

create policy "Authenticated users can delete product review images"
on storage.objects for delete
using (bucket_id = 'product-review-images' and auth.role() = 'authenticated');
