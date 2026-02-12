insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'return-images',
  'return-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow authenticated users to upload return images'
  ) then
    create policy "Allow authenticated users to upload return images"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'return-images' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow public read for return images'
  ) then
    create policy "Allow public read for return images"
    on storage.objects for select
    to public
    using (bucket_id = 'return-images');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow authenticated users to update their return images'
  ) then
    create policy "Allow authenticated users to update their return images"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'return-images' and auth.role() = 'authenticated')
    with check (bucket_id = 'return-images' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow authenticated users to delete their return images'
  ) then
    create policy "Allow authenticated users to delete their return images"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'return-images' and auth.role() = 'authenticated');
  end if;
end $$;
