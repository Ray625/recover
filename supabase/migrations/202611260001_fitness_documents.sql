begin;

create table if not exists public.fitness_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint fitness_document_format check (
    jsonb_typeof(data) = 'object'
    and data @> '{"version":1}'::jsonb
    and jsonb_typeof(data->'categories') = 'array'
    and jsonb_typeof(data->'exercises') = 'array'
    and jsonb_typeof(data->'workouts') = 'array'
    and data ?& array['categories','exercises','workouts']
  )
);

alter table public.fitness_documents enable row level security;
revoke all on public.fitness_documents from anon, authenticated;
grant select, insert, update on public.fitness_documents to authenticated;

drop policy if exists fitness_owner_select on public.fitness_documents;
create policy fitness_owner_select on public.fitness_documents for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists fitness_owner_insert on public.fitness_documents;
create policy fitness_owner_insert on public.fitness_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists fitness_owner_update on public.fitness_documents;
create policy fitness_owner_update on public.fitness_documents for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- An atomic compare-and-swap avoids overwriting another device's newer document.
-- SECURITY INVOKER keeps RLS active; the caller cannot supply a different owner.
create or replace function public.save_fitness_document(p_data jsonb, p_expected_revision bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.fitness_documents;
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision = 0 then
    insert into public.fitness_documents (user_id, data, revision)
      values (owner_id, p_data, 1)
      on conflict (user_id) do nothing
      returning * into saved;
  elsif p_expected_revision > 0 then
    update public.fitness_documents
      set data = p_data, revision = revision + 1, updated_at = now()
      where user_id = owner_id and revision = p_expected_revision
      returning * into saved;
  else
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if saved.user_id is null then
    raise exception 'Sync conflict' using errcode = '40001';
  end if;
  return jsonb_build_object('data', saved.data, 'revision', saved.revision);
end;
$$;
revoke all on function public.save_fitness_document(jsonb, bigint) from public, anon;
grant execute on function public.save_fitness_document(jsonb, bigint) to authenticated;

commit;
