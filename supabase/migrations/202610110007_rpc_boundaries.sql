begin;
-- Only the fixed POS/WEB wrappers may enter the internal sale transaction.
create or replace function public.create_pos_sale(payload jsonb) returns uuid language sql security definer set search_path='' as $$select private.create_sale(payload,false)$$;
create or replace function public.create_web_order(payload jsonb) returns uuid language sql security definer set search_path='' as $$select private.create_sale(payload,true)$$;
revoke all on function private.create_sale(jsonb,boolean) from public,anon,authenticated,service_role;
revoke all on function public.create_pos_sale(jsonb),public.create_web_order(jsonb) from public,anon,authenticated;
grant execute on function public.create_pos_sale(jsonb) to authenticated;
grant execute on function public.create_web_order(jsonb) to service_role;
commit;
