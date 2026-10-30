begin;

-- Cada código identifica exactamente un producto. La tabla permite sumar
-- códigos secundarios / presentaciones en una versión posterior.
create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null unique
    check (char_length(code) between 4 and 80 and code ~ '^[!-~]+$'),
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index product_barcodes_one_primary
  on public.product_barcodes(product_id) where is_primary;
create index product_barcodes_product on public.product_barcodes(product_id);

alter table public.product_barcodes enable row level security;
revoke all on public.product_barcodes from public, anon, authenticated;
grant select on public.product_barcodes to authenticated;
create policy barcode_read on public.product_barcodes for select
  to authenticated using (
    private.allowed('products') or private.allowed('stock') or
    private.allowed('pos') or private.allowed('catalog') or
    private.allowed('dashboard')
  );

-- La creación y el vínculo se confirman en una sola transacción.
-- Reutiliza save_product: no altera las reglas existentes del stock inicial.
create function public.save_product_with_barcode(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  product_id uuid;
  code_value text;
  old_code text;
begin
  perform private.require_permission('products');
  code_value := nullif(btrim(payload->>'barcode'), '');
  if code_value is not null and
     (char_length(code_value) not between 4 and 80 or
      code_value !~ '^[!-~]+$') then
    raise exception 'Código de barras inválido (4–80 caracteres sin espacios)';
  end if;

  perform pg_advisory_xact_lock(741125);
  product_id := public.save_product(payload - 'barcode');

  select b.code into old_code from public.product_barcodes b
    where b.product_id = product_id and b.is_primary for update;

  if old_code is distinct from code_value then
    delete from public.product_barcodes
      where public.product_barcodes.product_id = product_id and is_primary;
    if code_value is not null then
      if exists(select 1 from public.product_barcodes b
                where b.code = code_value and b.product_id <> product_id) then
        raise exception 'Este código ya está asociado a otro producto';
      end if;
      insert into public.product_barcodes(product_id,code,is_primary)
        values(product_id,code_value,true);
    end if;
  end if;

  return product_id;
end $$;
-- Asegurar que no se exponga por los grants por defecto.
revoke all on function public.save_product_with_barcode(jsonb) from public,anon,authenticated;
grant execute on function public.save_product_with_barcode(jsonb) to authenticated;
commit;
