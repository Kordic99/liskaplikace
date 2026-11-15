-- Real Postgres regression checks; disposable users/rows are entirely rolled back.
begin;
select set_config('lisk.shop.a',gen_random_uuid()::text,true),set_config('lisk.shop.b',gen_random_uuid()::text,true),set_config('lisk.shop.book',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('lisk.shop.a')::uuid,current_setting('lisk.shop.a')||'@shopping-test.invalid'),
 (current_setting('lisk.shop.b')::uuid,current_setting('lisk.shop.b')||'@shopping-test.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lisk.shop.a'),true);
insert into public.archive_books(user_id,id,data) values(auth.uid(),current_setting('lisk.shop.book')::uuid,
 jsonb_build_object('title','Disposable shopping test','author','QA','cover','','customCover',auth.uid()::text||'/00000000-0000-4000-8000-000000000009.jpg',
 'isbn','','pages',100,'currentPage',5,'status','tbr','rating',3.5,'priority','normal','wantToBuy',false,'tags','[]'::jsonb,'series','','description','Keep description',
 'notes','[{"id":"note","type":"note","title":"Keep","content":"Keep this note","page":5,"spoiler":false,"createdAt":""}]'::jsonb,
 'characters','[{"id":"hero","name":"Keep hero","role":"","description":""}]'::jsonb,'addedAt','','startedAt','','finishedAt',''));

do $$
declare book_id uuid:=current_setting('lisk.shop.book')::uuid; payload jsonb;
begin
 select b.data into payload from public.archive_books b where b.id=book_id;
 perform public.archive_save_book(book_id,0,jsonb_set(payload,'{status}','"shopping"'));
 if exists(select 1 from public.archive_books) or (select count(*) from public.archive_shopping)<>1 then raise exception 'Transfer left duplicate or missing rows'; end if;
 if not exists(select 1 from public.archive_shopping s where s.id=book_id and s.revision=1 and s.data->'notes'=payload->'notes' and s.data->'characters'=payload->'characters' and s.data->'customCover'=payload->'customCover' and s.data->'rating'=payload->'rating') then raise exception 'Transfer lost book data'; end if;
 begin perform public.archive_save_book(book_id,0,payload);raise exception 'Stale write accepted';exception when serialization_failure then null;end;
 begin perform public.archive_save_book(book_id,1,jsonb_set(jsonb_set(payload,'{status}','"tbr"'),'{title}','""'));raise exception 'Invalid destination accepted';exception when check_violation then null;end;
 if (select count(*) from public.archive_shopping)<>1 or exists(select 1 from public.archive_books) then raise exception 'Failed transfer did not roll back';end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('lisk.shop.b'),true);
do $$
begin
 if exists(select 1 from public.archive_shopping) or exists(select 1 from public.archive_books) then raise exception 'Cross-account read allowed';end if;
 begin perform public.archive_save_book(current_setting('lisk.shop.book')::uuid,1,'{}');raise exception 'Cross-account transfer allowed';exception when serialization_failure then null;end;
 begin perform public.archive_delete_book(current_setting('lisk.shop.book')::uuid,1);raise exception 'Cross-account delete allowed';exception when serialization_failure then null;end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('lisk.shop.a'),true);
do $$
declare book_id uuid:=current_setting('lisk.shop.book')::uuid; payload jsonb;
begin
 select s.data into payload from public.archive_shopping s where s.id=book_id;
 begin update public.archive_shopping set user_id=current_setting('lisk.shop.b')::uuid,revision=revision+1 where id=book_id;raise exception 'Shopping ownership mutable';exception when check_violation then null;end;
 perform public.archive_save_book(book_id,1,jsonb_set(payload,'{status}','"tbr"'));
 if exists(select 1 from public.archive_shopping) or not exists(select 1 from public.archive_books b where b.id=book_id and b.revision=2 and b.data->>'wantToBuy'='false') then raise exception 'Explicit transfer back failed';end if;
 begin insert into public.archive_shopping(user_id,id,data) values(auth.uid(),book_id,payload);raise exception 'Cross-collection duplicate accepted';exception when unique_violation then null;end;
 perform public.archive_delete_book(book_id,2);
 if exists(select 1 from public.archive_books) or exists(select 1 from public.archive_shopping) then raise exception 'Delete failed';end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
 begin perform 1 from public.archive_shopping;raise exception 'Anonymous shopping access allowed';exception when insufficient_privilege then null;end;
 begin perform public.archive_save_book(current_setting('lisk.shop.book')::uuid,0,'{}');raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then null;end;
end;
$$;
reset role;
rollback;
select 'PASS: atomic shopping transfers, rollback, preserved notes/covers/ratings, increasing revisions, cross-account isolation and anonymous denial; fixtures rolled back' as result;
