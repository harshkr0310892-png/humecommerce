drop policy if exists "Allow public insert for contact submissions" on public.contact_submissions;
drop policy if exists "Authenticated insert for contact submissions" on public.contact_submissions;

create policy "Authenticated insert for contact submissions"
on public.contact_submissions
for insert
to authenticated
with check (true);

drop policy if exists "Allow public upload for contact photos" on storage.objects;
drop policy if exists "Allow public read for contact photos" on storage.objects;
drop policy if exists "contact photos: anon insert" on storage.objects;
drop policy if exists "contact photos: public read" on storage.objects;

create policy "Allow authenticated upload for contact photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'contact-photos' and auth.role() = 'authenticated');

create policy "Allow public read for contact photos"
on storage.objects
for select
to public
using (bucket_id = 'contact-photos');
