-- Ejecutar una vez en el SQL Editor de TU proyecto Supabase.
-- No contiene contraseñas ni claves. Puede ejecutarse de nuevo sin borrar datos.
create table if not exists public.inventory_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (display_name in ('Luis','Ximena'))
);
create table if not exists public.shared_inventory (
  id boolean primary key default true check (id),
  revision bigint not null default 0,
  data jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  last_mutation_id uuid
);
create table if not exists public.inventory_mutations (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  revision bigint not null,
  created_at timestamptz not null default now()
);
insert into public.shared_inventory(id) values(true) on conflict do nothing;
alter table public.inventory_members enable row level security;
alter table public.shared_inventory enable row level security;
alter table public.inventory_mutations enable row level security;
revoke all on public.inventory_members,public.shared_inventory,public.inventory_mutations from anon,authenticated;
grant select on public.inventory_members,public.shared_inventory to authenticated;
drop policy if exists own_membership on public.inventory_members;
create policy own_membership on public.inventory_members for select to authenticated using (user_id=auth.uid());
drop policy if exists member_inventory on public.shared_inventory;
create policy member_inventory on public.shared_inventory for select to authenticated using (exists(select 1 from public.inventory_members m where m.user_id=auth.uid()));
create or replace function public.save_shared_inventory(expected_revision bigint,new_data jsonb,mutation_id uuid)
returns setof public.shared_inventory
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row public.shared_inventory; previous_user uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.inventory_members where user_id=auth.uid()) then
    raise exception 'INVENTORY_FORBIDDEN' using errcode='42501';
  end if;
  if new_data is null or jsonb_typeof(new_data)<>'object' or (new_data->>'version') is distinct from '1' or
     jsonb_typeof(new_data->'materials') is distinct from 'array' or jsonb_typeof(new_data->'movements') is distinct from 'array' or
     jsonb_typeof(new_data->'ready') is distinct from 'object' or octet_length(new_data::text)>10000000 then
    raise exception 'INVENTORY_INVALID';
  end if;
  if mutation_id is null or expected_revision is null then raise exception 'INVENTORY_INVALID'; end if;
  select * into current_row from public.shared_inventory where id=true for update;
  if not found then raise exception 'INVENTORY_NOT_INITIALIZED'; end if;
  select user_id into previous_user from public.inventory_mutations where id=mutation_id;
  if found then
    if previous_user<>auth.uid() then raise exception 'INVENTORY_FORBIDDEN' using errcode='42501'; end if;
    return query select * from public.shared_inventory where id=true;
    return;
  end if;
  if current_row.revision<>expected_revision then raise exception 'INVENTORY_CONFLICT'; end if;
  update public.shared_inventory set data=new_data,revision=current_row.revision+1,
    updated_at=clock_timestamp(),updated_by=auth.uid(),last_mutation_id=mutation_id where id=true;
  insert into public.inventory_mutations(id,user_id,revision) values(mutation_id,auth.uid(),current_row.revision+1);
  return query select * from public.shared_inventory where id=true;
end; $$;
revoke all on function public.save_shared_inventory(bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_shared_inventory(bigint,jsonb,uuid) to authenticated;
-- Habilita eventos de cambios únicamente si la publicación estándar existe.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and
    not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_inventory') then
  alter publication supabase_realtime add table public.shared_inventory;
 end if;
end $$;
