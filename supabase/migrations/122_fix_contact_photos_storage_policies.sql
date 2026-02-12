insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-photos',
  'contact-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Allow public upload for contact photos" on storage.objects;
drop policy if exists "Allow public read for contact photos" on storage.objects;

create policy "Allow public upload for contact photos"
on storage.objects for insert
to public
with check (bucket_id = 'contact-photos');

create policy "Allow public read for contact photos"
on storage.objects for select
to public
using (bucket_id = 'contact-photos');
