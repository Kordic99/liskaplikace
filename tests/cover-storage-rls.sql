begin;
select set_config('lisk.covers.a',gen_random_uuid()::text,true),set_config('lisk.covers.b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role) values (current_setting('lisk.covers.a')::uuid,'authenticated','authenticated'),(current_setting('lisk.covers.b')::uuid,'authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lisk.covers.a'),true);
insert into storage.objects(bucket_id,name,owner_id) values ('book-covers',auth.uid()::text||'/'||gen_random_uuid()::text||'.jpg',auth.uid()::text);
do $$begin
 if (select count(*) from storage.objects where bucket_id='book-covers')<>1 then raise exception 'A cannot read own image'; end if;
 begin
  insert into storage.objects(bucket_id,name,owner_id) values ('book-covers',current_setting('lisk.covers.b')||'/'||gen_random_uuid()::text||'.jpg',auth.uid()::text);
  raise exception 'Cross-owner upload unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('lisk.covers.b'),true);
do $$declare changed integer;begin
 if exists(select 1 from storage.objects where bucket_id='book-covers') then raise exception 'B can read A image'; end if;
 update storage.objects set metadata='{}'::jsonb where bucket_id='book-covers';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'B can modify A image';end if;
end $$;
insert into storage.objects(bucket_id,name,owner_id) values ('book-covers',auth.uid()::text||'/'||gen_random_uuid()::text||'.jpg',auth.uid()::text);
set local role anon;
do $$begin
 if exists(select 1 from storage.objects where bucket_id='book-covers') then raise exception 'Anonymous image read allowed';end if;
end $$;
reset role;
select 'PASS cover storage: two-account ownership, cross-owner upload/update and anonymous denial' as result;
rollback;
