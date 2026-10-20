-- Execute on a migrated Supabase database. All test users and rows roll back.
begin;
select set_config('lisk.test.a',gen_random_uuid()::text,true), set_config('lisk.test.b',gen_random_uuid()::text,true), set_config('lisk.test.book',gen_random_uuid()::text,true);
insert into auth.users (id,email) values
 (current_setting('lisk.test.a')::uuid,current_setting('lisk.test.a')||'@lisk-test.invalid'),
 (current_setting('lisk.test.b')::uuid,current_setting('lisk.test.b')||'@lisk-test.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lisk.test.a'),true);
insert into public.archive_preferences(user_id,theme_id) values (auth.uid(),'autumn');
insert into public.archive_books(user_id,id,data) values (auth.uid(),current_setting('lisk.test.book')::uuid,
 '{"title":"Disposable isolation test","author":"Test","cover":"","isbn":"","pages":0,"currentPage":0,"status":"paused","rating":0,"priority":"normal","tags":[],"series":"","description":"","notes":[],"characters":[],"addedAt":"","startedAt":"","finishedAt":""}'::jsonb);
do $$
begin
 if (select count(*) from public.archive_books) <> 1 then raise exception 'Owner cannot see their book'; end if;
 if (select data->>'status' from public.archive_books) <> 'tbr' then raise exception 'Legacy paused status not normalized'; end if;
 begin
  insert into public.archive_preferences(user_id,theme_id) values (current_setting('lisk.test.b')::uuid,'forest');
  raise exception 'Cross-owner insert unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 update public.archive_preferences set theme_id='midnight',revision=2 where user_id=auth.uid() and revision=1;
 begin
  update public.archive_preferences set theme_id='dragon',revision=2 where user_id=auth.uid();
  raise exception 'Stale revision unexpectedly allowed';
 exception when serialization_failure then null; end;
 begin
  update public.archive_preferences set user_id=current_setting('lisk.test.b')::uuid,revision=3 where user_id=auth.uid();
  raise exception 'Preference ownership unexpectedly mutable';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('lisk.test.b'),true);
do $$
declare changed integer;
begin
 if exists(select 1 from public.archive_preferences) then raise exception 'Reader B can read reader A preferences'; end if;
 if exists(select 1 from public.archive_books) then raise exception 'Reader B can read reader A books'; end if;
 update public.archive_preferences set theme_id='forest',revision=3 where user_id=current_setting('lisk.test.a')::uuid;
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Cross-owner preference update allowed'; end if;
 update public.archive_books set data=jsonb_set(data,'{title}','"Changed"'),revision=revision+1 where user_id=current_setting('lisk.test.a')::uuid;
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Cross-owner book update allowed'; end if;
 insert into public.archive_preferences(user_id,theme_id) values(auth.uid(),'forest');
 if (select count(*) from public.archive_preferences) <> 1 then raise exception 'B cannot see their preferences'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('lisk.test.a'),true);
do $$
begin
 if (select theme_id from public.archive_preferences) <> 'midnight' then raise exception 'B changed A theme'; end if;
 if (select count(*) from public.archive_books) <> 1 then raise exception 'Book isolation failed'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
 begin perform 1 from public.archive_preferences; raise exception 'Anonymous preferences access allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.archive_books; raise exception 'Anonymous books access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: owner access, cross-account isolation, anonymous denial, revision checks, legacy TBR normalization; test rows rolled back' as result;
