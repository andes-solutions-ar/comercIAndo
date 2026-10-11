begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated,service_role;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(length(full_name) between 1 and 120),
 access_level text not null default 'admin' check(access_level in ('admin','super_admin')),
 display_role text not null default 'Administrador',
 permissions jsonb not null default '{}'::jsonb check(jsonb_typeof(permissions)='object'),
 active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create function private.allowed(permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active and (access_level='super_admin' or permissions->permission='true'::jsonb))
$$;
revoke all on function private.allowed(text) from public;
grant execute on function private.allowed(text) to authenticated,service_role;
create function private.require_permission(permission text) returns void language plpgsql security invoker set search_path='' as $$
begin if not private.allowed(permission) then raise exception 'Acceso denegado' using errcode='42501';end if;end $$;
revoke all on function private.require_permission(text) from public;
grant execute on function private.require_permission(text) to authenticated,service_role;
create function private.touch() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end $$;
create table public.app_settings (
 id boolean primary key default true check(id),store_name text not null default 'Mi comercio' check(length(store_name) between 1 and 120),
 business_category text not null default 'Comercio minorista',tax_id text,tax_condition text,
 tax_rate numeric(5,2) not null default 21 check(tax_rate between 0 and 100),
 public_catalog_enabled boolean not null default false,web_orders_enabled boolean not null default false,
 show_availability boolean not null default true,online_payments_enabled boolean not null default false check(not online_payments_enabled),
 sound_enabled boolean not null default true,live_stock_discount boolean not null default true check(live_stock_discount),
 auto_print boolean not null default false,business_module text not null default 'quotes' check(business_module in ('quotes','staff_shifts')),
 updated_at timestamptz not null default now(),created_at timestamptz not null default now(),
 check(not web_orders_enabled or public_catalog_enabled)
);
insert into public.app_settings default values;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or private.allowed('users'));
create policy settings_read on public.app_settings for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy settings_update on public.app_settings for update to authenticated using(private.allowed('settings')) with check(private.allowed('settings'));
revoke all on public.profiles,public.app_settings from anon,authenticated;
grant select on public.profiles,public.app_settings to authenticated;
grant update(store_name,business_category,tax_id,tax_condition,tax_rate,public_catalog_enabled,web_orders_enabled,show_availability,online_payments_enabled,sound_enabled,live_stock_discount,auto_print,business_module) on public.app_settings to authenticated;
create trigger settings_touch before update on public.app_settings for each row execute function private.touch();
create trigger profiles_touch before update on public.profiles for each row execute function private.touch();
commit;
