-- Each account owns its acknowledgement; books and theme revisions are unaffected.
create table public.archive_release_reads (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_release integer not null default 0 check (last_seen_release >= 0),
 updated_at timestamptz not null default now()
);
alter table public.archive_release_reads enable row level security;
revoke all on public.archive_release_reads from public, anon, authenticated;
grant select, insert, update on public.archive_release_reads to authenticated;
create policy "read own release acknowledgements" on public.archive_release_reads for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own release acknowledgements" on public.archive_release_reads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own release acknowledgements" on public.archive_release_reads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.archive_release_reads_monotonic() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then
  if NEW.user_id <> OLD.user_id then raise exception 'Release acknowledgement ownership is immutable' using errcode='23514'; end if;
  NEW.last_seen_release := greatest(OLD.last_seen_release, NEW.last_seen_release);
 end if;
 NEW.updated_at := now();
 return NEW;
end;
$$;
revoke all on function public.archive_release_reads_monotonic() from public, anon, authenticated;
create trigger archive_release_reads_monotonic before insert or update on public.archive_release_reads for each row execute function public.archive_release_reads_monotonic();
alter publication supabase_realtime add table public.archive_release_reads;
