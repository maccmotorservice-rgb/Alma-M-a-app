-- Ejecutar en SQL Editor del mismo proyecto de Alma Mía.
-- Crea un depósito privado para comprobantes (imágenes o PDF, máximo 8 MB).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-evidence','payment-evidence',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists alma_evidence_read on storage.objects;
create policy alma_evidence_read on storage.objects for select to authenticated
using(bucket_id='payment-evidence' and exists(select 1 from public.inventory_members where user_id=auth.uid()));
drop policy if exists alma_evidence_insert on storage.objects;
create policy alma_evidence_insert on storage.objects for insert to authenticated
with check(bucket_id='payment-evidence' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.inventory_members where user_id=auth.uid()));
drop policy if exists alma_evidence_delete on storage.objects;
create policy alma_evidence_delete on storage.objects for delete to authenticated
using(bucket_id='payment-evidence' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.inventory_members where user_id=auth.uid()));
