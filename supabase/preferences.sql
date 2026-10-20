-- Account-owned preferences. No application administrator role is introduced.
create table public.archive_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme_id text not null default 'dragon' check (theme_id in ('dragon','autumn','forest','midnight')),
 show_sticker boolean not null default true,
 revision integer not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now()
);
alter table public.archive_preferences enable row level security;
revoke all on public.archive_preferences from public, anon, authenticated;
grant select, insert, update on public.archive_preferences to authenticated;
create policy "read own preferences" on public.archive_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own preferences" on public.archive_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own preferences" on public.archive_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.archive_preferences_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if TG_OP = 'INSERT' then
  if NEW.revision <> 1 then raise exception 'Preferences start at revision one' using errcode='23514'; end if;
 else
  if NEW.user_id <> OLD.user_id then raise exception 'Preference ownership is immutable' using errcode='23514'; end if;
  if NEW.revision <> OLD.revision + 1 then raise exception 'Stale preference revision' using errcode='40001'; end if;
 end if;
 NEW.updated_at := now();
 return NEW;
end;
$$;
revoke all on function public.archive_preferences_revision() from public, anon, authenticated;
create trigger archive_preferences_revision before insert or update on public.archive_preferences for each row execute function public.archive_preferences_revision();
alter publication supabase_realtime add table public.archive_preferences;
