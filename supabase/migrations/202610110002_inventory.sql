begin;
create table public.products (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 160),category text not null check(length(category) between 1 and 100),
 price numeric(14,2) not null check(price>=0),stock_quantity integer not null default 0 check(stock_quantity>=0),minimum_stock integer not null default 0 check(minimum_stock>=0),
 visual_hue integer not null default 210 check(visual_hue between 0 and 360),published boolean not null default false,active boolean not null default true,
 item_type text not null default 'product' check(item_type in ('product','service')),track_stock boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(),request_id uuid unique,product_id uuid not null references public.products,
 type text not null check(type in ('Entrada','Salida')),quantity integer not null check(quantity>0),reference text not null,
 responsible uuid references public.profiles,source_type text not null check(source_type in ('initial','manual','sale','delivery')),source_id uuid,
 created_at timestamptz not null default now()
);
create index stock_movements_product on public.stock_movements(product_id);
create index stock_movements_date on public.stock_movements(created_at desc);
create index products_catalog on public.products(active,published);
create trigger products_touch before update on public.products for each row execute function private.touch();
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
create policy products_read on public.products for select to authenticated using(private.allowed('products') or private.allowed('pos') or private.allowed('stock') or private.allowed('catalog') or private.allowed('module') or private.allowed('dashboard'));
create policy moves_read on public.stock_movements for select to authenticated using(private.allowed('stock') or private.allowed('dashboard'));
revoke all on public.products,public.stock_movements from anon,authenticated;
grant select on public.products,public.stock_movements to authenticated;
create function public.save_product(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; initial integer;begin
 perform private.require_permission('products');perform pg_advisory_xact_lock(741125);
 result=nullif(payload->>'id','')::uuid;
 if result is null then
  initial=coalesce((payload->>'stock_quantity')::integer,0);
  insert into public.products(name,category,price,stock_quantity,minimum_stock,visual_hue,published,active,item_type,track_stock)
  values(trim(payload->>'name'),trim(payload->>'category'),(payload->>'price')::numeric,initial,(payload->>'minimum_stock')::integer,(payload->>'visual_hue')::integer,coalesce((payload->>'published')::boolean,false),coalesce((payload->>'active')::boolean,true),coalesce(payload->>'item_type','product'),coalesce((payload->>'track_stock')::boolean,true)) returning id into result;
  if initial>0 then insert into public.stock_movements(product_id,type,quantity,reference,responsible,source_type,source_id) values(result,'Entrada',initial,'Stock inicial',auth.uid(),'initial',result);end if;
 else
  update public.products set name=trim(payload->>'name'),category=trim(payload->>'category'),price=(payload->>'price')::numeric,minimum_stock=(payload->>'minimum_stock')::integer,visual_hue=(payload->>'visual_hue')::integer,published=(payload->>'published')::boolean,active=(payload->>'active')::boolean,item_type=payload->>'item_type'
  where id=result;
  if not found then raise exception 'Producto inexistente';end if;
 end if;return result;end $$;
revoke all on function public.save_product(jsonb) from public;
grant execute on function public.save_product(jsonb) to authenticated;
commit;
