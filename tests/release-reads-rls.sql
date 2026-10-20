begin;
select set_config('lisk.release.a',gen_random_uuid()::text,true);
select set_config('lisk.release.b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role) values
 (current_setting('lisk.release.a')::uuid,'authenticated','authenticated'),
 (current_setting('lisk.release.b')::uuid,'authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lisk.release.a'),true);
insert into public.archive_release_reads(user_id,last_seen_release) values(auth.uid(),1);
do $$begin
 if (select last_seen_release from public.archive_release_reads where user_id=auth.uid()) <> 1 then raise exception 'A cannot read own acknowledgement'; end if;
 begin
  insert into public.archive_release_reads(user_id,last_seen_release) values(current_setting('lisk.release.b')::uuid,2);
  raise exception 'Cross-owner insert unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('lisk.release.b'),true);
do $$declare changed integer; begin
 if exists(select 1 from public.archive_release_reads) then raise exception 'B can read A acknowledgement'; end if;
 update public.archive_release_reads set last_seen_release=99 where user_id=current_setting('lisk.release.a')::uuid;
 get diagnostics changed=row_count;
 if changed <> 0 then raise exception 'B can update A acknowledgement'; end if;
end $$;
insert into public.archive_release_reads(user_id,last_seen_release) values(auth.uid(),0);
select set_config('request.jwt.claim.sub',current_setting('lisk.release.a'),true);
insert into public.archive_release_reads(user_id,last_seen_release) values(auth.uid(),2)
 on conflict(user_id) do update set last_seen_release=excluded.last_seen_release;
-- A slow PC only knows release 1; the phone has already acknowledged release 2.
insert into public.archive_release_reads(user_id,last_seen_release) values(auth.uid(),1)
 on conflict(user_id) do update set last_seen_release=excluded.last_seen_release;
do $$begin
 if (select last_seen_release from public.archive_release_reads where user_id=auth.uid()) <> 2 then raise exception 'Stale client moved read cursor backwards'; end if;
 begin
  update public.archive_release_reads set user_id=current_setting('lisk.release.b')::uuid where user_id=auth.uid();
  raise exception 'Ownership unexpectedly mutable';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('lisk.release.b'),true);
do $$begin
 if (select last_seen_release from public.archive_release_reads where user_id=auth.uid()) <> 0 then raise exception 'A acknowledgement changed B cursor'; end if;
end $$;
set local role anon;
do $$begin
 begin
  perform 1 from public.archive_release_reads;
  raise exception 'Anonymous read unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS two account isolation, independent cursors, monotonic stale upsert and anonymous denial' as result;
rollback;
