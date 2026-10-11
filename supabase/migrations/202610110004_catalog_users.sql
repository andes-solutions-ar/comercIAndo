begin;
create function public.get_public_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select case when c.public_catalog_enabled then jsonb_build_object('store_name',c.store_name,'business_category',c.business_category,'web_orders_enabled',c.web_orders_enabled,'show_availability',c.show_availability,'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'price',p.price,'visual_hue',p.visual_hue,'track_stock',p.track_stock,'available',case when c.show_availability and p.track_stock then private.available(p.id) end) order by p.name) from public.products p where p.active and p.published),'[]'::jsonb)) else jsonb_build_object('enabled',false) end from public.app_settings c where c.id
$$;
revoke all on function public.get_public_catalog() from public;grant execute on function public.get_public_catalog() to anon,authenticated;
create table private.order_rate_limits (key text primary key,window_start timestamptz not null,hits integer not null);
create function public.check_order_rate(rate_key text) returns void language plpgsql security definer set search_path='' as $$
declare n integer;begin
 insert into private.order_rate_limits values(rate_key,now(),1) on conflict(key) do update set hits=case when private.order_rate_limits.window_start<now()-interval '10 minutes' then 1 else private.order_rate_limits.hits+1 end,window_start=case when private.order_rate_limits.window_start<now()-interval '10 minutes' then now() else private.order_rate_limits.window_start end returning hits into n;
 if n>20 then raise exception 'Demasiados pedidos. Intentá más tarde';end if;
 delete from private.order_rate_limits where window_start<now()-interval '1 day';
end $$;
revoke all on function public.check_order_rate(text) from public;grant execute on function public.check_order_rate(text) to service_role;
create table public.user_invitations (
 id uuid primary key default gen_random_uuid(),email text not null check(length(email) between 3 and 254),full_name text not null check(length(full_name) between 1 and 120),
 display_role text not null default 'Administrador',permissions jsonb not null default '{}'::jsonb check(jsonb_typeof(permissions)='object'),
 status text not null default 'pending' check(status in ('pending','completed','failed')),user_id uuid references auth.users,
 created_by uuid not null references public.profiles,created_at timestamptz not null default now()
);
create unique index invitation_pending_email on public.user_invitations(lower(email)) where status='pending';
create index invitations_creator on public.user_invitations(created_by);
alter table public.user_invitations enable row level security;
revoke all on public.user_invitations from anon,authenticated;grant select on public.user_invitations to authenticated;
create policy invitation_read on public.user_invitations for select to authenticated using(private.allowed('users'));
create function private.require_super() returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and access_level='super_admin') then raise exception 'Sólo Andes Solutions puede administrar accesos' using errcode='42501';end if;
end $$;
revoke all on function private.require_super() from public;grant execute on function private.require_super() to authenticated;
create function public.reserve_invitation(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin perform private.require_super();perform pg_advisory_xact_lock(741126);
 if (select count(*) from public.profiles where access_level='admin' and active)+(select count(*) from public.user_invitations where status='pending')>=3 then raise exception 'Máximo 3 administradores activos o invitados';end if;
 insert into public.user_invitations(email,full_name,display_role,permissions,created_by) values(lower(trim(payload->>'email')),trim(payload->>'full_name'),coalesce(payload->>'display_role','Administrador'),coalesce(payload->'permissions','{}'::jsonb),auth.uid()) returning id into result;return result;
end $$;
revoke all on function public.reserve_invitation(jsonb) from public;grant execute on function public.reserve_invitation(jsonb) to authenticated;
create function public.finish_invitation(invitation uuid,invited_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.user_invitations;begin perform pg_advisory_xact_lock(741126);select * into strict i from public.user_invitations where id=invitation and status='pending' for update;
 if invited_user is null then update public.user_invitations set status='failed' where id=invitation;return;end if;
 if not exists(select 1 from auth.users where id=invited_user and lower(email)=i.email) then raise exception 'El usuario no coincide con la invitación';end if;
 insert into public.profiles(id,full_name,display_role,permissions) values(invited_user,i.full_name,i.display_role,i.permissions);
 update public.user_invitations set status='completed',user_id=invited_user where id=invitation;
end $$;
revoke all on function public.finish_invitation(uuid,uuid) from public;grant execute on function public.finish_invitation(uuid,uuid) to service_role;
create function public.update_admin(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles;begin perform private.require_super();perform pg_advisory_xact_lock(741126);select * into strict p from public.profiles where id=(payload->>'id')::uuid for update;
 if p.access_level='super_admin' then raise exception 'El acceso de Andes Solutions está protegido';end if;
 if (payload->>'active')::boolean and not p.active and (select count(*) from public.profiles where access_level='admin' and active)+(select count(*) from public.user_invitations where status='pending')>=3 then raise exception 'Máximo 3 administradores activos o invitados';end if;
 update public.profiles set active=(payload->>'active')::boolean,full_name=trim(payload->>'full_name'),display_role=payload->>'display_role',permissions=payload->'permissions' where id=p.id;
end $$;
revoke all on function public.update_admin(jsonb) from public;grant execute on function public.update_admin(jsonb) to authenticated;
commit;
