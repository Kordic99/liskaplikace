-- Original user uploads only. Each immutable image belongs to one account.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('book-covers','book-covers',false,262144,array['image/jpeg']);

create policy "read own book covers" on storage.objects for select to authenticated
using (bucket_id='book-covers' and (storage.foldername(name))[1]=(select auth.uid())::text and owner_id=(select auth.uid())::text);
create policy "upload own book covers" on storage.objects for insert to authenticated
with check (bucket_id='book-covers' and (storage.foldername(name))[1]=(select auth.uid())::text and owner_id=(select auth.uid())::text);
create policy "delete own book covers" on storage.objects for delete to authenticated
using (bucket_id='book-covers' and (storage.foldername(name))[1]=(select auth.uid())::text and owner_id=(select auth.uid())::text);
