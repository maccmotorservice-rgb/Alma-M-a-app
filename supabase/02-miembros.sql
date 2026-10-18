-- Antes: crea las dos cuentas en Authentication > Users > Add user.
-- Sustituye estos correos por los de las cuentas que acabas de crear.
insert into public.inventory_members(user_id,display_name)
select id,'Luis' from auth.users where lower(email)=lower('CORREO_DE_LUIS')
on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.inventory_members(user_id,display_name)
select id,'Ximena' from auth.users where lower(email)=lower('CORREO_DE_XIMENA')
on conflict(user_id) do update set display_name=excluded.display_name;
-- Deben aparecer DOS filas. Si falta una, revisa el correo y que exista en Authentication.
select display_name,user_id from public.inventory_members order by display_name;
