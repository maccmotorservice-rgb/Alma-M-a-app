-- Ejecutar UNA VEZ en SQL Editor del mismo proyecto de Alma Mía.
-- Se puede repetir: no borra inventario, tiras, comprobantes ni usuarios.
-- Requiere 01-configurar.sql y los miembros Luis/Ximena ya configurados.
-- Biblioteca PRIVADA: los dos miembros comparten las mismas imágenes.
-- Cada objeto ocupa como máximo 8 MB; una imagen mayor se divide sin pérdida.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('strip-library','strip-library',false,8388608,array['image/jpeg','image/png','image/webp','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists alma_strips_read on storage.objects;
create policy alma_strips_read on storage.objects for select to authenticated
using(bucket_id='strip-library' and exists(select 1 from public.inventory_members where user_id=auth.uid()));

drop policy if exists alma_strips_insert on storage.objects;
create policy alma_strips_insert on storage.objects for insert to authenticated
with check(bucket_id='strip-library' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.inventory_members where user_id=auth.uid()));

-- Ambos miembros pueden retirar archivos compartidos. No se permite sobrescribir
-- objetos: cada versión se sube con una ruta nueva y después se publica su referencia.
drop policy if exists alma_strips_delete on storage.objects;
create policy alma_strips_delete on storage.objects for delete to authenticated
using(bucket_id='strip-library' and exists(select 1 from public.inventory_members where user_id=auth.uid()));

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
  -- Older app versions omit this key. Their stock/sales changes must not erase
  -- the shared strip library uploaded by a newer browser.
  if not (new_data ? 'stripLibrary') and current_row.data ? 'stripLibrary' then
    new_data := jsonb_set(new_data,'{stripLibrary}',current_row.data->'stripLibrary',true);
  end if;
  if new_data ? 'stripLibrary' and (
    jsonb_typeof(new_data->'stripLibrary') is distinct from 'object' or
    (new_data->'stripLibrary'->>'version') is distinct from '1' or
    jsonb_typeof(new_data->'stripLibrary'->'entries') is distinct from 'array' or
    jsonb_typeof(new_data->'stripLibrary'->'deleted') is distinct from 'array'
  ) then raise exception 'INVENTORY_INVALID'; end if;
  if octet_length(new_data::text)>10000000 then raise exception 'INVENTORY_INVALID'; end if;
  update public.shared_inventory set data=new_data,revision=current_row.revision+1,
    updated_at=clock_timestamp(),updated_by=auth.uid(),last_mutation_id=mutation_id where id=true;
  insert into public.inventory_mutations(id,user_id,revision) values(mutation_id,auth.uid(),current_row.revision+1);
  return query select * from public.shared_inventory where id=true;
end; $$;
revoke all on function public.save_shared_inventory(bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_shared_inventory(bigint,jsonb,uuid) to authenticated;
