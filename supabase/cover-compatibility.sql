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
    -- Older open clients do not know customCover; an absent key must not delete it.
    if not (NEW.data ? 'customCover') and OLD.data ? 'customCover' then
      NEW.data := jsonb_set(NEW.data, '{customCover}', OLD.data->'customCover');
    end if;
    NEW.created_at := OLD.created_at;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
