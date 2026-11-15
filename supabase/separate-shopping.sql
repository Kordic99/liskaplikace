begin;
-- Separate account-owned collections; move existing shopping rows without losing book data.
lock table public.archive_books in share row exclusive mode;
create temporary table shopping_migration_before on commit drop as
select * from public.archive_books;

create table public.archive_shopping (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 data jsonb not null,
 revision integer not null default 0 check(revision >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 constraint archive_shopping_data check(coalesce(
  jsonb_typeof(data)='object' and octet_length(data::text)<=5242880
  and jsonb_typeof(data->'title')='string' and length(btrim(data->>'title')) between 1 and 300
  and data->>'status'='shopping' and data->'wantToBuy'='true'::jsonb
  and jsonb_typeof(data->'notes')='array' and jsonb_typeof(data->'characters')='array'
  and data ?& array['title','author','cover','isbn','pages','currentPage','status','rating','priority','tags','series','description','notes','characters','addedAt','startedAt','finishedAt'],false))
);
alter table public.archive_shopping enable row level security;
revoke all on public.archive_shopping from public,anon,authenticated;
grant select,insert,update,delete on public.archive_shopping to authenticated;
create policy "read own shopping" on public.archive_shopping for select to authenticated using((select auth.uid())=user_id);
create policy "insert own shopping" on public.archive_shopping for insert to authenticated with check((select auth.uid())=user_id);
create policy "update own shopping" on public.archive_shopping for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "delete own shopping" on public.archive_shopping for delete to authenticated using((select auth.uid())=user_id);

create or replace function public.archive_guard_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if NEW.data->>'status'='paused' then NEW.data:=jsonb_set(NEW.data,'{status}','"tbr"'::jsonb); end if;
 if TG_OP='INSERT' then
  -- Transfers keep a monotonically increasing revision; new client-created books start at zero.
  if NEW.revision < 0 then raise exception 'Invalid revision' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text||':'||NEW.id::text,0));
  if (TG_TABLE_NAME='archive_books' and exists(select 1 from public.archive_shopping s where s.user_id=NEW.user_id and s.id=NEW.id))
   or (TG_TABLE_NAME='archive_shopping' and exists(select 1 from public.archive_books b where b.user_id=NEW.user_id and b.id=NEW.id)) then
   raise exception 'Book already belongs to the other collection' using errcode='23505';
  end if;
 else
  if NEW.user_id<>OLD.user_id or NEW.id<>OLD.id then raise exception 'Book ownership is immutable' using errcode='23514'; end if;
  if NEW.revision<>OLD.revision+1 then raise exception 'Stale book revision' using errcode='40001'; end if;
  if not(NEW.data ? 'customCover') and OLD.data ? 'customCover' then NEW.data:=jsonb_set(NEW.data,'{customCover}',OLD.data->'customCover'); end if;
  NEW.created_at:=OLD.created_at;
 end if;
 NEW.updated_at:=now();
 return NEW;
end;
$$;
revoke all on function public.archive_guard_revision() from public,anon,authenticated;
create trigger archive_guard_revision before insert or update on public.archive_shopping for each row execute function public.archive_guard_revision();

delete from public.archive_books where data->>'wantToBuy'='true';
insert into public.archive_shopping(user_id,id,data,revision,created_at,updated_at)
select user_id,id,jsonb_set(data,'{status}','"shopping"'::jsonb),revision+1,created_at,now()
from shopping_migration_before where data->>'wantToBuy'='true';
alter table public.archive_books add constraint archive_library_not_shopping
check(coalesce(data->>'wantToBuy','false')='false');

create function public.archive_save_book(p_id uuid,p_revision integer,p_data jsonb)
returns table(id uuid,revision integer,data jsonb)
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); item public.archive_books%rowtype; in_shopping boolean:=false; target_shopping boolean;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text||':'||p_id::text,0));
 select b.* into item from public.archive_books b where b.user_id=owner_id and b.id=p_id for update;
 if not found then
  select s.* into item from public.archive_shopping s where s.user_id=owner_id and s.id=p_id for update;
  in_shopping:=true;
 end if;
 if item.id is null or p_revision is null or item.revision<>p_revision then raise exception 'Stale book revision' using errcode='40001'; end if;
 target_shopping:=coalesce(p_data->>'status'='shopping',false);
 p_data:=jsonb_set(p_data,'{wantToBuy}',to_jsonb(target_shopping));
 if not(p_data ? 'customCover') and item.data ? 'customCover' then p_data:=jsonb_set(p_data,'{customCover}',item.data->'customCover'); end if;
 if in_shopping=target_shopping then
  if in_shopping then
   return query update public.archive_shopping s set data=p_data,revision=s.revision+1 where s.user_id=owner_id and s.id=p_id returning s.id,s.revision,s.data;
  else
   return query update public.archive_books b set data=p_data,revision=b.revision+1 where b.user_id=owner_id and b.id=p_id returning b.id,b.revision,b.data;
  end if;
 else
  -- The entire function is one transaction: a failed insert restores the source row.
  if in_shopping then delete from public.archive_shopping s where s.user_id=owner_id and s.id=p_id;
  else delete from public.archive_books b where b.user_id=owner_id and b.id=p_id; end if;
  if target_shopping then
   return query insert into public.archive_shopping as s(user_id,id,data,revision,created_at)
    values(owner_id,p_id,p_data,item.revision+1,item.created_at) returning s.id,s.revision,s.data;
  else
   return query insert into public.archive_books as b(user_id,id,data,revision,created_at)
    values(owner_id,p_id,p_data,item.revision+1,item.created_at) returning b.id,b.revision,b.data;
  end if;
 end if;
end;
$$;
revoke all on function public.archive_save_book(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.archive_save_book(uuid,integer,jsonb) to authenticated;

create function public.archive_delete_book(p_id uuid,p_revision integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); affected integer;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text||':'||p_id::text,0));
 delete from public.archive_books b where b.user_id=owner_id and b.id=p_id and b.revision=p_revision;
 get diagnostics affected=row_count;
 if affected=0 then
  delete from public.archive_shopping s where s.user_id=owner_id and s.id=p_id and s.revision=p_revision;
  get diagnostics affected=row_count;
 end if;
 if affected<>1 then raise exception 'Stale book revision' using errcode='40001'; end if;
 return true;
end;
$$;
revoke all on function public.archive_delete_book(uuid,integer) from public,anon,authenticated;
grant execute on function public.archive_delete_book(uuid,integer) to authenticated;

do $$
begin
 if (select count(*) from shopping_migration_before)<>(select count(*) from public.archive_books)+(select count(*) from public.archive_shopping) then
  raise exception 'Migration changed the number of books';
 end if;
 if exists(
  select 1 from shopping_migration_before old
  left join (select * from public.archive_books union all select * from public.archive_shopping) current
   on current.user_id=old.user_id and current.id=old.id
  where current.id is null or (current.data-'status') is distinct from (old.data-'status')
   or current.created_at<>old.created_at
   or current.revision<>old.revision+case when old.data->>'wantToBuy'='true' then 1 else 0 end
 ) then raise exception 'Migration did not preserve book data'; end if;
 if exists(select 1 from public.archive_books b join public.archive_shopping s using(user_id,id)) then raise exception 'Collections overlap'; end if;
end;
$$;
notify pgrst,'reload schema';

commit;
