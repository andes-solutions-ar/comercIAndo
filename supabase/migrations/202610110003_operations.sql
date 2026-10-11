begin;
create table public.sales (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,sale_number bigint generated always as identity unique,
 customer_name text not null check(length(customer_name) between 1 and 160),channel text not null check(channel in ('POS','WEB')),
 status text not null check(status in ('Cobrada','Pedido','Pendiente','Cancelada')),
 subtotal numeric(14,2) not null check(subtotal>=0),tax_amount numeric(14,2) not null check(tax_amount>=0),total numeric(14,2) not null check(total>=0),
 payment_method text not null check(payment_method in ('Efectivo','Débito','Digital')),settings_snapshot jsonb not null,
 created_by uuid references public.profiles,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(total=subtotal+tax_amount)
);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales,product_id uuid references public.products,
 product_name text not null,quantity integer not null check(quantity>0),unit_price numeric(14,2) not null check(unit_price>=0),line_total numeric(14,2) not null check(line_total=quantity*unit_price)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),sale_id uuid not null unique references public.sales,method text not null check(method in ('Efectivo','Débito','Digital')),
 amount numeric(14,2) not null check(amount>=0),status text not null check(status in ('Aprobado','Pendiente','Cancelado')),
 provider_reference text,cash_received numeric(14,2),change_amount numeric(14,2) not null default 0 check(change_amount>=0),confirmed_by uuid references public.profiles,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.stock_reservations (
 id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales,product_id uuid not null references public.products,
 quantity integer not null check(quantity>0),status text not null default 'active' check(status in ('active','released','consumed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(sale_id,product_id)
);
create table public.deliveries (
 id uuid primary key default gen_random_uuid(),sale_id uuid not null unique references public.sales,
 status text not null default 'Pendiente' check(status in ('Pendiente','Preparado','Entregado','Cancelado')),
 prepared_by uuid references public.profiles,delivered_by uuid references public.profiles,prepared_at timestamptz,delivered_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sales_date on public.sales(created_at desc);create index sales_status on public.sales(status);create index sales_channel on public.sales(channel);create index sales_creator on public.sales(created_by);
create index items_sale on public.sale_items(sale_id);create index items_product on public.sale_items(product_id);
create index payments_status on public.payments(status);create index payments_date on public.payments(created_at desc);
create index reservations_product on public.stock_reservations(product_id,status);create index reservations_sale on public.stock_reservations(sale_id);create index deliveries_status on public.deliveries(status);
create function private.available(product uuid) returns integer language sql stable security definer set search_path='' as $$
 select p.stock_quantity-coalesce((select sum(r.quantity)::integer from public.stock_reservations r where r.product_id=p.id and r.status='active'),0) from public.products p where p.id=product
$$;
revoke all on function private.available(uuid) from public;
create function public.inventory() returns table(product_id uuid,reserved bigint,available integer) language sql stable security definer set search_path='' as $$
 select p.id,coalesce(sum(r.quantity) filter(where r.status='active'),0),private.available(p.id) from public.products p left join public.stock_reservations r on r.product_id=p.id
 where private.allowed('stock') or private.allowed('products') or private.allowed('pos') or private.allowed('catalog') or private.allowed('dashboard') or private.allowed('module') group by p.id
$$;
revoke all on function public.inventory() from public;grant execute on function public.inventory() to authenticated;
do $$declare t text;begin foreach t in array array['sales','sale_items','payments','stock_reservations','deliveries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t<>'sale_items' then execute format('create trigger touch before update on public.%I for each row execute function private.touch()',t);end if;
 end loop;end $$;
create policy sales_read on public.sales for select to authenticated using(private.allowed('sales') or private.allowed('payments') or private.allowed('deliveries') or private.allowed('dashboard') or (created_by=(select auth.uid()) and private.allowed('pos')));
create policy items_read on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id));
create policy payments_read on public.payments for select to authenticated using(private.allowed('payments') or private.allowed('dashboard'));
create policy reservations_read on public.stock_reservations for select to authenticated using(private.allowed('stock') or private.allowed('deliveries') or private.allowed('dashboard'));
create policy deliveries_read on public.deliveries for select to authenticated using(private.allowed('deliveries') or private.allowed('dashboard'));
create function public.move_stock(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.products; qty integer; result uuid; kind text;begin
 perform private.require_permission('stock');perform pg_advisory_xact_lock(741125);
 select id into result from public.stock_movements where request_id=(payload->>'request_id')::uuid and responsible=auth.uid();if found then return result;end if;
 qty=(payload->>'quantity')::integer;kind=payload->>'type';
 if qty is null or qty<=0 or kind not in ('Entrada','Salida') or length(trim(payload->>'reference')) not between 1 and 240 then raise exception 'Movimiento inválido';end if;
 select * into strict p from public.products where id=(payload->>'product_id')::uuid for update;
 if not p.track_stock then raise exception 'Este servicio no controla stock';end if;
 if kind='Salida' and private.available(p.id)<qty then raise exception 'Stock disponible insuficiente';end if;
 update public.products set stock_quantity=stock_quantity+(case when kind='Entrada' then qty else -qty end) where id=p.id;
 insert into public.stock_movements(request_id,product_id,type,quantity,reference,responsible,source_type) values((payload->>'request_id')::uuid,p.id,kind,qty,trim(payload->>'reference'),auth.uid(),'manual') returning id into result;return result;
end $$;
revoke all on function public.move_stock(jsonb) from public;grant execute on function public.move_stock(jsonb) to authenticated;
create function private.create_sale(payload jsonb,is_web boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare cfg public.app_settings;p public.products;line record;result uuid;total_amount numeric(14,2)=0;net numeric(14,2);qty integer;method text;cash numeric(14,2);approved boolean;
begin
 if is_web and current_setting('role',true)<>'service_role' then raise exception 'Acceso denegado' using errcode='42501';end if;
 if not is_web then perform private.require_permission('pos');end if;
 perform pg_advisory_xact_lock(741125);
 select * into strict cfg from public.app_settings where id;
 if is_web and not(cfg.public_catalog_enabled and cfg.web_orders_enabled) then raise exception 'Los pedidos web están deshabilitados';end if;
 select id into result from public.sales where request_id=(payload->>'request_id')::uuid and channel=case when is_web then 'WEB' else 'POS' end and (is_web or created_by=auth.uid());if found then return result;end if;
 if payload->'items' is null or jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Carrito vacío o inválido';end if;
 if exists(select 1 from jsonb_array_elements(payload->'items') x where jsonb_typeof(x)<>'object' or x->>'quantity' is null or (x->>'quantity')::integer<=0 or (x->>'quantity')::integer>100000) then raise exception 'Cantidad inválida';end if;
 if length(trim(payload->>'customer_name')) not between 1 and 160 then raise exception 'Ingresá un cliente válido';end if;
 for line in select (x->>'product_id')::uuid pid,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(payload->'items') x group by 1 order by 1 loop
  if line.qty is null or line.qty<=0 or line.qty>100000 then raise exception 'Cantidad inválida';end if;
  select * into strict p from public.products where id=line.pid for update;
  if not p.active or(is_web and not p.published) then raise exception 'Producto no disponible';end if;
  if p.track_stock and private.available(p.id)<line.qty then raise exception 'Stock disponible insuficiente para %',p.name;end if;
  total_amount=total_amount+p.price*line.qty;
 end loop;
 method=case when is_web then 'Digital' else payload->>'payment_method' end;
 if method is null or method not in ('Efectivo','Débito','Digital') then raise exception 'Medio de pago inválido';end if;
 cash=nullif(payload->>'cash_received','')::numeric;
 if method='Efectivo' and(cash is null or cash<total_amount) then raise exception 'El efectivo recibido no cubre el total';end if;
 approved=not is_web and method in ('Efectivo','Débito');net=round(total_amount/(1+cfg.tax_rate/100),2);
 insert into public.sales(request_id,customer_name,channel,status,subtotal,tax_amount,total,payment_method,settings_snapshot,created_by)
 values((payload->>'request_id')::uuid,trim(payload->>'customer_name'),case when is_web then 'WEB' else 'POS' end,case when is_web then 'Pedido' when approved then 'Cobrada' else 'Pendiente' end,net,total_amount-net,total_amount,method,jsonb_build_object('store_name',cfg.store_name,'tax_id',cfg.tax_id,'tax_condition',cfg.tax_condition,'tax_rate',cfg.tax_rate),case when is_web then null else auth.uid() end) returning id into result;
 for line in select (x->>'product_id')::uuid pid,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(payload->'items') x group by 1 order by 1 loop
  select * into strict p from public.products where id=line.pid;
  insert into public.sale_items(sale_id,product_id,product_name,quantity,unit_price,line_total) values(result,p.id,p.name,line.qty,p.price,p.price*line.qty);
  if p.track_stock then
   if is_web then insert into public.stock_reservations(sale_id,product_id,quantity) values(result,p.id,line.qty);
   else update public.products set stock_quantity=stock_quantity-line.qty where id=p.id;
    insert into public.stock_movements(product_id,type,quantity,reference,responsible,source_type,source_id) values(p.id,'Salida',line.qty,'Venta POS',auth.uid(),'sale',result);
   end if;
  end if;
 end loop;
 insert into public.payments(sale_id,method,amount,status,cash_received,change_amount,confirmed_by) values(result,method,total_amount,case when approved then 'Aprobado' else 'Pendiente' end,case when method='Efectivo' then cash end,case when method='Efectivo' then cash-total_amount else 0 end,case when approved then auth.uid() end);
 if is_web then insert into public.deliveries(sale_id) values(result);end if;return result;
end $$;
revoke all on function private.create_sale(jsonb,boolean) from public;
create function public.create_pos_sale(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_sale(payload,false)$$;
grant execute on function private.create_sale(jsonb,boolean) to authenticated,service_role;
create function public.create_web_order(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_sale(payload,true)$$;
revoke all on function public.create_pos_sale(jsonb),public.create_web_order(jsonb) from public;
grant execute on function public.create_pos_sale(jsonb) to authenticated;
grant execute on function public.create_web_order(jsonb) to service_role;
create function public.confirm_payment(payment uuid) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin perform private.require_permission('payments');perform pg_advisory_xact_lock(741125);
 update public.payments set status='Aprobado',confirmed_by=auth.uid() where id=payment and status='Pendiente' returning sale_id into sid;
 if not found then raise exception 'El pago ya fue confirmado o cancelado';end if;
 update public.sales set status='Cobrada' where id=sid and status<>'Cancelada';end $$;
revoke all on function public.confirm_payment(uuid) from public;grant execute on function public.confirm_payment(uuid) to authenticated;
create function public.advance_delivery(delivery uuid) returns text language plpgsql security definer set search_path='' as $$
declare d public.deliveries;r record;begin
 perform private.require_permission('deliveries');perform pg_advisory_xact_lock(741125);select * into strict d from public.deliveries where id=delivery for update;
 if d.status='Pendiente' then update public.deliveries set status='Preparado',prepared_by=auth.uid(),prepared_at=now() where id=d.id;return 'Preparado';end if;
 if d.status<>'Preparado' then raise exception 'La entrega ya está completada o cancelada';end if;
 if not exists(select 1 from public.payments where sale_id=d.sale_id and status='Aprobado') then raise exception 'Confirmá el cobro antes de entregar';end if;
 for r in select * from public.stock_reservations where sale_id=d.sale_id and status='active' order by product_id for update loop
  update public.products set stock_quantity=stock_quantity-r.quantity where id=r.product_id;
  insert into public.stock_movements(product_id,type,quantity,reference,responsible,source_type,source_id) values(r.product_id,'Salida',r.quantity,'Entrega web',auth.uid(),'delivery',d.id);
 end loop;
 update public.stock_reservations set status='consumed' where sale_id=d.sale_id and status='active';
 update public.deliveries set status='Entregado',delivered_by=auth.uid(),delivered_at=now() where id=d.id;return 'Entregado';end $$;
revoke all on function public.advance_delivery(uuid) from public;grant execute on function public.advance_delivery(uuid) to authenticated;
create function public.cancel_web_order(sale uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_permission('deliveries');perform pg_advisory_xact_lock(741125);
 if exists(select 1 from public.payments where sale_id=sale and status='Aprobado') then raise exception 'Pedido cobrado: requiere gestionar devolución antes de cancelar';end if;
 update public.deliveries set status='Cancelado' where sale_id=sale and status in ('Pendiente','Preparado');if not found then raise exception 'El pedido no se puede cancelar';end if;
 update public.stock_reservations set status='released' where sale_id=sale and status='active';update public.sales set status='Cancelada' where id=sale;update public.payments set status='Cancelado' where sale_id=sale;
end $$;
revoke all on function public.cancel_web_order(uuid) from public;grant execute on function public.cancel_web_order(uuid) to authenticated;
commit;
