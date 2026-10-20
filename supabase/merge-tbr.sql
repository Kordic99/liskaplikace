-- Preserve old clients/backups while using only three canonical statuses.
create or replace function public.archive_guard_revision() returns trigger
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
update public.archive_books set data = jsonb_set(data, '{status}', '"tbr"'::jsonb), revision = revision + 1 where data->>'status' = 'paused';
