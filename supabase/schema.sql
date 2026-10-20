create table public.archive_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  constraint archive_book_data check (coalesce((
    jsonb_typeof(data) = 'object'
    and octet_length(data::text) <= 5242880
    and jsonb_typeof(data->'title') = 'string'
    and length(btrim(data->>'title')) between 1 and 300
    and data->>'status' in ('tbr','reading','read','paused')
    and jsonb_typeof(data->'notes') = 'array'
    and jsonb_typeof(data->'characters') = 'array'
    and data ?& array['title','author','cover','isbn','pages','currentPage','status','rating','priority','tags','series','description','notes','characters','addedAt','startedAt','finishedAt']
  ), false))
);
alter table public.archive_books enable row level security;
revoke all on public.archive_books from anon, authenticated;
grant select, insert, update, delete on public.archive_books to authenticated;
create policy "read own books" on public.archive_books for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own books" on public.archive_books for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own books" on public.archive_books for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own books" on public.archive_books for delete to authenticated using ((select auth.uid()) = user_id);

create function public.archive_guard_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if NEW.data->>'status' = 'paused' then
    NEW.data := jsonb_set(NEW.data, '{status}', '"tbr"'::jsonb);
  end if;
  if TG_OP = 'INSERT' then
    if NEW.revision <> 0 then raise exception 'New books start at revision zero' using errcode='23514'; end if;
  else
    if NEW.user_id <> OLD.user_id or NEW.id <> OLD.id then raise exception 'Book ownership is immutable' using errcode='23514'; end if;
    if NEW.revision <> OLD.revision + 1 then raise exception 'Stale book revision' using errcode='40001'; end if;
    NEW.created_at := OLD.created_at;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
revoke all on function public.archive_guard_revision() from public, anon, authenticated;
create trigger archive_guard_revision before insert or update on public.archive_books for each row execute function public.archive_guard_revision();

alter publication supabase_realtime add table public.archive_books;
