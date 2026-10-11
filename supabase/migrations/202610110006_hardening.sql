begin;
-- Supabase projects may grant functions to anon/authenticated through default privileges.
-- Revoke direct grants as well as PUBLIC, then grant only each RPC's intended role.
do $$declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='public' and p.proname=any(array['save_product','inventory','move_stock','create_pos_sale','create_web_order','confirm_payment','advance_delivery','cancel_web_order','get_public_catalog','check_order_rate','reserve_invitation','finish_invitation','update_admin','save_quote','accept_quote','save_staff','save_shift']))
 or(n.nspname='private' and p.proname=any(array['allowed','require_permission','touch','available','create_sale','require_super','require_module']))
 loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;
end $$;
grant execute on function private.allowed(text),private.require_permission(text),private.require_super(),private.create_sale(jsonb,boolean) to authenticated;
grant execute on function private.create_sale(jsonb,boolean) to service_role;
grant execute on function public.save_product(jsonb),public.inventory(),public.move_stock(jsonb),public.create_pos_sale(jsonb),public.confirm_payment(uuid),public.advance_delivery(uuid),public.cancel_web_order(uuid),public.reserve_invitation(jsonb),public.update_admin(jsonb),public.save_quote(jsonb),public.accept_quote(uuid),public.save_staff(jsonb),public.save_shift(jsonb) to authenticated;
grant execute on function public.get_public_catalog() to anon,authenticated;
grant execute on function public.create_web_order(jsonb),public.check_order_rate(text),public.finish_invitation(uuid,uuid) to service_role;
alter table private.order_rate_limits enable row level security;
revoke all on private.order_rate_limits from public,anon,authenticated;
commit;

