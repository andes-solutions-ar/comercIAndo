begin;
create table public.quotes (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,quote_number bigint generated always as identity unique,
 customer_name text not null check(length(customer_name) between 1 and 160),status text not null default 'Enviado' check(status in ('Enviado','Aceptado')),
 total numeric(14,2) not null check(total>=0),created_by uuid not null references public.profiles,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.quote_items (
 id uuid primary key default gen_random_uuid(),quote_id uuid not null references public.quotes,product_id uuid references public.products,
 product_name text not null check(length(product_name) between 1 and 160),quantity integer not null check(quantity>0),unit_price numeric(14,2) not null check(unit_price>=0),line_total numeric(14,2) not null check(line_total=quantity*unit_price)
);
create table public.staff_members (
 id uuid primary key default gen_random_uuid(),full_name text not null check(length(full_name) between 1 and 120),role text not null check(length(role) between 1 and 120),active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.shifts (
 id uuid primary key default gen_random_uuid(),staff_id uuid not null references public.staff_members,start_at timestamptz not null,end_at timestamptz not null check(end_at>start_at),
 status text not null default 'Programado' check(status in ('Programado','Completado','Cancelado')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index quotes_date on public.quotes(created_at desc);create index quote_items_quote on public.quote_items(quote_id);create index quote_items_product on public.quote_items(product_id);create index quotes_creator on public.quotes(created_by);create index shifts_staff on public.shifts(staff_id,start_at);
create function private.require_module(module_name text) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.require_permission('module');if not exists(select 1 from public.app_settings where business_module=module_name) then raise exception 'Este módulo empresarial no está activo';end if;
end $$;
revoke all on function private.require_module(text) from public;
do $$declare t text;begin foreach t in array array['quotes','quote_items','staff_members','shifts'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy module_read on public.%I for select to authenticated using(private.allowed(''module''))',t);
 if t<>'quote_items' then execute format('create trigger touch before update on public.%I for each row execute function private.touch()',t);end if;
 end loop;end $$;
create function public.save_quote(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;line jsonb;p public.products;name text;price numeric(14,2);qty integer;amount numeric(14,2)=0;begin
 perform private.require_module('quotes');perform pg_advisory_xact_lock(741127);
 select id into result from public.quotes where request_id=(payload->>'request_id')::uuid and created_by=auth.uid();if found then return result;end if;
 if payload->'items' is null or jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Presupuesto sin ítems';end if;
 insert into public.quotes(request_id,customer_name,total,created_by) values((payload->>'request_id')::uuid,trim(payload->>'customer_name'),0,auth.uid()) returning id into result;
 for line in select * from jsonb_array_elements(payload->'items') loop
  qty=(line->>'quantity')::integer;
  if nullif(line->>'product_id','') is not null then select * into strict p from public.products where id=(line->>'product_id')::uuid and active;name=p.name;price=p.price;
  else name=trim(line->>'product_name');price=(line->>'unit_price')::numeric;end if;
  insert into public.quote_items(quote_id,product_id,product_name,quantity,unit_price,line_total) values(result,nullif(line->>'product_id','')::uuid,name,qty,price,qty*price);amount=amount+qty*price;
 end loop;update public.quotes set total=amount where id=result;return result;end $$;
revoke all on function public.save_quote(jsonb) from public;grant execute on function public.save_quote(jsonb) to authenticated;
create function public.accept_quote(quote uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.require_module('quotes');update public.quotes set status='Aceptado' where id=quote and status='Enviado';if not found then raise exception 'El presupuesto ya está aceptado o no existe';end if;end $$;
revoke all on function public.accept_quote(uuid) from public;grant execute on function public.accept_quote(uuid) to authenticated;
create function public.save_staff(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin perform private.require_module('staff_shifts');result=nullif(payload->>'id','')::uuid;
 if result is null then insert into public.staff_members(full_name,role,active) values(trim(payload->>'full_name'),trim(payload->>'role'),coalesce((payload->>'active')::boolean,true)) returning id into result;
 else update public.staff_members set full_name=trim(payload->>'full_name'),role=trim(payload->>'role'),active=(payload->>'active')::boolean where id=result;if not found then raise exception 'Personal inexistente';end if;end if;return result;end $$;
revoke all on function public.save_staff(jsonb) from public;grant execute on function public.save_staff(jsonb) to authenticated;
create function public.save_shift(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin perform private.require_module('staff_shifts');perform pg_advisory_xact_lock(741128);result=nullif(payload->>'id','')::uuid;
 if result is null then
 if not exists(select 1 from public.staff_members where id=(payload->>'staff_id')::uuid and active) then raise exception 'Personal inactivo';end if;
 if exists(select 1 from public.shifts where staff_id=(payload->>'staff_id')::uuid and status<>'Cancelado' and start_at<(payload->>'end_at')::timestamptz and end_at>(payload->>'start_at')::timestamptz) then raise exception 'El turno se superpone con otro existente';end if;
 insert into public.shifts(staff_id,start_at,end_at) values((payload->>'staff_id')::uuid,(payload->>'start_at')::timestamptz,(payload->>'end_at')::timestamptz) returning id into result;
 else update public.shifts set status=payload->>'status' where id=result;if not found then raise exception 'Turno inexistente';end if;end if;return result;end $$;
revoke all on function public.save_shift(jsonb) from public;grant execute on function public.save_shift(jsonb) to authenticated;
commit;
