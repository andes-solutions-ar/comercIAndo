begin;
-- Versioned PostgreSQL document for the supplied remake. No browser-local
-- operational state is trusted as storage; all commits are serialized here.
create table public.remake_state (
 id boolean primary key default true check(id), version bigint not null default 0,
 data jsonb not null check(jsonb_typeof(data)='object'), updated_at timestamptz not null default now()
);
insert into public.remake_state(data) values ('{"settings":{"storeName":"ComercIAndo","category":"Comercio","sound":true,"branch":"Sucursal Centro","branches":["Sucursal Centro"],"timeZone":"America/Argentina/Buenos_Aires","currency":"ARS","locale":"es-AR","storeOpen":false,"shipping":0,"transferEnabled":false},"categories":["General"],"products":[],"sales":[],"payments":[],"movements":[],"deliveries":[],"quotes":[],"users":[],"customers":[],"orderFlow":[],"archivedOrders":[],"cashSessions":[],"cashMoves":[],"refunds":[],"audit":[],"revision":0,"deliveryMigration":true,"stockPro":{"schema":1,"suppliers":[],"catalog":[],"requests":[],"purchases":[],"lots":[],"retail":{"schema":1,"locations":[],"placements":[],"approvals":[],"movements":[]}}}'::jsonb);
create table public.remake_events (
 request_id uuid primary key, actor uuid not null references public.profiles,
 version bigint not null, state_hash text not null, created_at timestamptz not null default now()
);
create sequence public.remake_operation_numbers start 1001;
revoke all on sequence public.remake_operation_numbers from public,anon,authenticated;
create table public.remake_web_orders (
 request_id uuid primary key, number bigint not null default nextval('public.remake_operation_numbers') unique,
 token uuid not null, fingerprint jsonb not null, data jsonb not null,
 inventory_consumed boolean not null default false, inventory_released boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.remake_state enable row level security;
alter table public.remake_events enable row level security;
alter table public.remake_web_orders enable row level security;
revoke all on public.remake_state,public.remake_events,public.remake_web_orders from public,anon,authenticated;

create function private.require_remake_admin() returns void language plpgsql security definer set search_path='' as $$
begin
 if not (private.allowed('dashboard') and private.allowed('pos') and private.allowed('catalog') and private.allowed('deliveries') and private.allowed('module') and private.allowed('products') and private.allowed('stock') and private.allowed('sales') and private.allowed('payments') and private.allowed('settings') and private.allowed('users')) then
 raise exception 'Se requiere un perfil administrativo activo con acceso completo' using errcode='42501'; end if;
end $$;
revoke all on function private.require_remake_admin() from public,anon,authenticated,service_role;

create function public.remake_load() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin perform private.require_remake_admin(); select jsonb_build_object('version',version,'state',data) into result from public.remake_state where id; return result;end $$;

create function public.remake_next_number() returns bigint language plpgsql security definer set search_path='' as $$
begin perform private.require_remake_admin();return nextval('public.remake_operation_numbers');end $$;
create function private.remake_pos_available(p jsonb, state jsonb) returns integer language sql stable set search_path='' as $$
 with stock as (select (p->>3)::integer physical,coalesce((p->10->>'onlineUnits')::integer,0)+coalesce((p->10->>'webReserved')::integer,0) reserved,
 coalesce((select sum((v->>'qty')::integer) from jsonb_array_elements(state#>'{stockPro,retail,placements}') v where v->>'productId'=p->10->>'id'),0)::integer displayed,
 coalesce((select sum((v->>'remaining')::integer) from jsonb_array_elements(state#>'{stockPro,retail,approvals}') v where v->>'productId'=p->10->>'id' and not coalesce((v->>'revoked')::boolean,false)),0)::integer extra)
 select greatest(0,least(physical,case when p->10->>'status'<>'enabled' then 0 when p->10->>'policy'='unlimited' then displayed+greatest(0,physical-displayed-reserved-extra) when p->10->>'policy'='limited' then displayed+extra else displayed end)) from stock
$$;
revoke all on function private.remake_pos_available(jsonb,jsonb) from public,anon,authenticated,service_role;

create function private.validate_remake(candidate jsonb, previous jsonb) returns void language plpgsql set search_path='' as $$
declare p jsonb; m jsonb; s jsonb; old_sale jsonb; line jsonb; item jsonb; ident text; names text[]='{}'; ids text[]='{}'; total numeric; discount numeric;
begin
 if jsonb_typeof(candidate)<>'object' or octet_length(candidate::text)>8000000 then raise exception 'Estado inválido o adjuntos demasiado grandes (máximo 8 MB por instancia)';end if;
 if candidate::text ~ '<[A-Za-z!/?]' then raise exception 'No se admite contenido HTML en los datos';end if;
 foreach ident in array array['products','sales','payments','movements','deliveries','quotes','customers','orderFlow','archivedOrders','cashSessions','cashMoves','refunds','audit','categories'] loop
 if jsonb_typeof(candidate->ident) is distinct from 'array' then raise exception 'Colección inválida: %',ident;end if;end loop;
 if jsonb_typeof(candidate->'settings') is distinct from 'object' then raise exception 'Configuración inválida';end if;
 if coalesce((candidate#>>'{settings,shipping}')::numeric,0)<0 then raise exception 'Envío inválido';end if;
 for p in select value from jsonb_array_elements(candidate->'products') loop
 m=p->10;ident=m->>'id';
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<11 or length(trim(p->>0)) not between 1 and 160 or length(p->>1)>100 or ident is null or ident=any(ids) or lower(p->>0)=any(names) then raise exception 'Producto inválido, nombre o identificador repetido';end if;
 ids=array_append(ids,ident);names=array_append(names,lower(p->>0));
 if jsonb_typeof(p->2) is distinct from 'number' or jsonb_typeof(p->3) is distinct from 'number' or jsonb_typeof(p->4) is distinct from 'number' or (p->>2)::numeric<0 or (p->>2)::numeric<>round((p->>2)::numeric,2) or (p->>3)::numeric<0 or (p->>3)::numeric<>trunc((p->>3)::numeric) or (p->>4)::numeric<0 then raise exception 'Precio, stock o mínimo inválido';end if;
 if coalesce((m->>'onlineUnits')::numeric,0)<0 or coalesce((m->>'webReserved')::numeric,0)<0 or coalesce((m->>'onlineUnits')::numeric,0)+coalesce((m->>'webReserved')::numeric,0)>(p->>3)::numeric then raise exception 'Las reservas online superan el stock físico';end if;
 if m->>'policy' not in ('unlimited','limited','restricted') or m->>'status' not in ('enabled','repricing','reserved','blocked') then raise exception 'Política comercial inválida';end if;
 end loop;
 for old_sale in select value from jsonb_array_elements(previous->'sales') loop
 select value into s from jsonb_array_elements(candidate->'sales') where value->>0=old_sale->>0;
 if s is null or s->3 is distinct from old_sale->3 or (s->7 is distinct from old_sale->7 and not(old_sale->>2='Web' and old_sale->7='[]'::jsonb)) or s->9 is distinct from old_sale->9 then raise exception 'No se puede borrar ni reescribir una venta histórica';end if;
 end loop;
 ids='{}';
 for s in select value from jsonb_array_elements(candidate->'sales') loop
 ident=s->>0;if ident is null or ident=any(ids) then raise exception 'Número de venta repetido';end if;ids=array_append(ids,ident);
 if s->>2='Web' then
 if not exists(select 1 from public.remake_web_orders w where '#'||w.number=ident and (s->>3)::numeric=(w.data->>'total')::numeric) then raise exception 'Venta web sin pedido real asociado';end if;
 select jsonb_agg(jsonb_build_object('name',x->>0,'qty',x->1,'price',x->2)) into item from public.remake_web_orders w cross join lateral jsonb_array_elements(w.data->'flowItems') x where '#'||w.number=ident;
 if s->7<>'[]'::jsonb and s->7 is distinct from item then raise exception 'Los ítems de la venta web deben coincidir con el pedido';end if;
 if s->>5='Cobrada' and (s->7='[]'::jsonb or not exists(select 1 from jsonb_array_elements(candidate->'payments') pay where pay->>1=regexp_replace(ident,'[^0-9]','','g') and (pay->>3)::numeric=(s->>3)::numeric and pay->>4='Aprobado')) then raise exception 'Falta el cobro de la venta web';end if;
 continue;
 end if;
 if exists(select 1 from jsonb_array_elements(previous->'sales') v where v->>0=ident) then continue;end if;
 total=0;
 if jsonb_typeof(s->7) is distinct from 'array' or jsonb_array_length(s->7)=0 then raise exception 'Una venta debe tener ítems';end if;
 for line in select value from jsonb_array_elements(s->7) loop
 if (line->>'qty')::numeric<=0 or (line->>'qty')::numeric<>trunc((line->>'qty')::numeric) or (line->>'price')::numeric<0 then raise exception 'Ítem de venta inválido';end if;
 select value into p from jsonb_array_elements(previous->'products') where value->10->>'id'=line->>'productId';
 if p is null or p->10->>'status'<>'enabled' then raise exception 'Producto no disponible para vender';end if;
 if p->10->>'policy'<>'unlimited' and (line->>'price')::numeric<>(p->>2)::numeric then raise exception 'Precio de producto controlado modificado';end if;
 if (line->>'qty')::numeric>private.remake_pos_available(p,previous) then raise exception 'Stock o cupo insuficiente para la venta';end if;
 total=total+round((line->>'qty')::numeric*(line->>'price')::numeric,2);
 end loop;
 discount=coalesce((s->9->>'discountAmount')::numeric,0);
 if discount<0 or discount>total or (s->>3)::numeric<>round(total-discount,2) then raise exception 'El total de la venta no coincide con sus ítems y descuento';end if;
 if not exists(select 1 from jsonb_array_elements(previous->'cashSessions') c where c->>'status'='open') then raise exception 'No hay una jornada de caja abierta';end if;
 if not exists(select 1 from jsonb_array_elements(candidate->'payments') pay where (pay->>1)=regexp_replace(ident,'[^0-9]','','g') and (pay->>3)::numeric=(s->>3)::numeric and pay->>4='Aprobado') then raise exception 'Falta el registro del cobro manual';end if;
 end loop;
end $$;
revoke all on function private.validate_remake(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.remake_commit(expected_version bigint, request_id uuid, next_state jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.remake_state; event public.remake_events; clean jsonb; result jsonb; ord public.remake_web_orders; flow jsonb; previous_flow jsonb; idx integer; item jsonb; p jsonb; m jsonb; required integer; supplied integer; actual integer;
begin
 perform private.require_remake_admin();
 clean=next_state-'users'-'currentUserIndex'-'revision';
 select * into current_row from public.remake_state where id for update;
 select * into event from public.remake_events e where e.request_id=remake_commit.request_id;
 if found then
 if event.actor<>auth.uid() or event.state_hash<>md5(clean::text) then raise exception 'Solicitud reutilizada con otros datos';end if;
 return jsonb_build_object('version',current_row.version,'state',current_row.data,'recovered',true);
 end if;
 if current_row.version<>expected_version then raise exception 'Los datos cambiaron en otra sesión. Se recargarán; revisá y repetí la operación.' using errcode='40001';end if;
 clean=clean||jsonb_build_object('users','[]'::jsonb);
 -- Server-owned web reservations cannot be overwritten by a snapshot.
 for ord in select * from public.remake_web_orders order by number for update loop
 select value into flow from jsonb_array_elements((clean->'orderFlow')||(clean->'archivedOrders')) where value->>'backendOrderId'=ord.request_id::text;
 if flow is null then raise exception 'No se puede eliminar un pedido web del historial';end if;
 if coalesce((flow->>'paymentConfirmed')::boolean,false) and not exists(select 1 from jsonb_array_elements(clean->'payments') pay where pay->>1=ord.number::text and (pay->>3)::numeric=(ord.data->>'total')::numeric and pay->>4='Aprobado') then raise exception 'Falta el cobro confirmado del pedido web';end if;
 if flow->'items' is distinct from ord.data->'flowItems' or (flow->>'total')::numeric<>(ord.data->>'total')::numeric then raise exception 'Los ítems e importes web son inmutables';end if;
 for item in select value from jsonb_array_elements(ord.data->'items') loop
 select (ordinality-1)::integer into idx from jsonb_array_elements(clean->'products') with ordinality where value->10->>'id'=item->>'id';
 if idx is null then raise exception 'No se puede borrar un producto asociado a un pedido web';end if;
 p=clean->'products'->idx;m=p->10;
 select coalesce((value->10->>'webReserved')::integer,0) into actual from jsonb_array_elements(current_row.data->'products') where value->10->>'id'=item->>'id';
 if coalesce((m->>'webReserved')::integer,0)<>actual then raise exception 'La reserva web sólo cambia en el servidor';end if;
 if not ord.inventory_consumed and not ord.inventory_released and (flow->>'status' in ('Cancelado','Anulado') or flow->>'stage'='cancelled') then
 actual=actual-(item->>'qty')::integer;m=m||jsonb_build_object('webReserved',actual,'onlineUnits',coalesce((m->>'onlineUnits')::integer,0)+(item->>'qty')::integer);
 elsif not ord.inventory_consumed and not ord.inventory_released and (flow->>'status'='Entregado' or flow->>'deliveredAt' is not null) then
 if not coalesce((flow->>'paymentConfirmed')::boolean,false) then raise exception 'No se puede entregar un pedido sin cobrar';end if;
 actual=actual-(item->>'qty')::integer;m=m||jsonb_build_object('webReserved',actual);
 clean=jsonb_set(clean,'{movements}',jsonb_build_array(jsonb_build_array('Salida',p->>0,'−'||(item->>'qty'),'Entrega Web #'||ord.number,'Servidor',to_char(now(),'HH24:MI'),jsonb_build_object('id',gen_random_uuid(),'at',now(),'qty',(item->>'qty')::integer,'stockBefore',p->3,'stockAfter',(p->>3)::integer-(item->>'qty')::integer,'source','web_delivery')))||(clean->'movements'));
 p=jsonb_set(p,'{3}',to_jsonb((p->>3)::integer-(item->>'qty')::integer));
 end if;
 clean=jsonb_set(clean,array['products',idx::text],jsonb_set(p,'{10}',m));
 end loop;
 update public.remake_web_orders set inventory_consumed=inventory_consumed or flow->>'status'='Entregado' or flow->>'deliveredAt' is not null,
 inventory_released=inventory_released or flow->>'status' in ('Cancelado','Anulado') or flow->>'stage'='cancelled',
 data=data||jsonb_build_object('status',case when flow->>'status'='Entregado' then 'delivered' when flow->>'stage'='cancelled' then 'cancelled' when flow->>'dispatchStage'='dispatched' then 'dispatched' when flow->>'dispatchStage'='ready' then 'ready' when flow->>'dispatchStage'='preparing' then 'preparing' else 'new' end,'paymentStatus',case when coalesce((flow->>'paymentConfirmed')::boolean,false) then 'paid' else 'pending' end)
 where remake_web_orders.request_id=ord.request_id;
 end loop;
 perform private.validate_remake(clean,current_row.data);
 -- Initial physical stock is always auditable, including a first product creation.
 for p in select value from jsonb_array_elements(clean->'products') loop
 if (p->>3)::integer>0 and not exists(select 1 from jsonb_array_elements(current_row.data->'products') old where old->10->>'id'=p->10->>'id') then
 clean=jsonb_set(clean,'{movements}',jsonb_build_array(jsonb_build_array('Entrada',p->>0,'+'||(p->>3),'Stock inicial',(select full_name from public.profiles where id=auth.uid()),to_char(now(),'HH24:MI'),jsonb_build_object('id',gen_random_uuid(),'at',now(),'qty',(p->>3)::integer,'stockBefore',0,'stockAfter',(p->>3)::integer,'source','initial','productId',p->10->>'id')))||(clean->'movements'));
 end if;end loop;
 -- A POS commit must consume exactly the quantities of its newly recorded lines.
 for p in select value from jsonb_array_elements(current_row.data->'products') loop
 select coalesce(sum((line->>'qty')::integer),0) into required from jsonb_array_elements(clean->'sales') s cross join lateral jsonb_array_elements(s->7) line
 where s->>2<>'Web' and not exists(select 1 from jsonb_array_elements(current_row.data->'sales') old where old->>0=s->>0) and line->>'productId'=p->10->>'id';
 if required>0 then
 select (value->>3)::integer into supplied from jsonb_array_elements(clean->'products') where value->10->>'id'=p->10->>'id';
 if supplied is null or supplied<>(p->>3)::integer-required then raise exception 'El stock no coincide con las unidades vendidas';end if;
 end if;
 end loop;
 update public.remake_state set data=clean,version=version+1,updated_at=now() where id returning jsonb_build_object('version',version,'state',data) into result;
 insert into public.remake_events values(request_id,auth.uid(),(result->>'version')::bigint,md5((next_state-'users'-'currentUserIndex'-'revision')::text),now());
 return result;
end $$;

create function public.remake_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('revision',s.version,'settings',jsonb_build_object('storeName',s.data#>>'{settings,storeName}','heroText',coalesce(s.data#>>'{settings,heroText}','Todo lo que buscás, en un solo lugar.'),'description',coalesce(s.data#>>'{settings,description}','Explorá nuestro catálogo.'),'shipping',coalesce(s.data#>'{settings,shipping}','0'::jsonb),'storeOpen',coalesce(s.data#>'{settings,storeOpen}','false'::jsonb),'transferEnabled',coalesce(s.data#>'{settings,transferEnabled}','false'::jsonb)),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',value,'name',value,'emoji','▤')) from jsonb_array_elements(s.data->'categories')),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p->10->>'id','name',p->>0,'category',p->>1,'price',p->2,'description',coalesce(p->10->>'description',''),'emoji',coalesce(p->>7,'▤'),'color',coalesce(p->>8,'#eef2ff'),'tag','','options','{}'::jsonb,'available',least((p->>3)::integer,coalesce((p->10->>'onlineUnits')::integer,0)),'published',true)) from jsonb_array_elements(s.data->'products') p where coalesce((p->10->>'onlinePublished')::boolean,false) and p->10->>'status'='enabled' and coalesce((p->10->>'onlineUnits')::integer,0)>0),'[]'::jsonb)) from public.remake_state s where s.id;
$$;

create function public.remake_checkout(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare st public.remake_state; existing public.remake_web_orders; req uuid; tok uuid; p jsonb; m jsonb; idx integer; item jsonb; rows jsonb='[]'; flow_items jsonb='[]'; flow jsonb; result jsonb; name text; phone text; address text; qty integer; subtotal numeric=0; shipping numeric; amount numeric; num bigint; product_ids text[]='{}'; delivery_code text;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Sólo servidor' using errcode='42501';end if;
 req=(payload->>'requestId')::uuid;tok=(payload->>'token')::uuid;
 select * into st from public.remake_state where id for update;
 select * into existing from public.remake_web_orders where request_id=req;
 if found then if existing.token<>tok or existing.fingerprint<>(payload-'requestId'-'token') then raise exception 'La solicitud ya fue utilizada';end if;return jsonb_build_object('order',existing.data,'recovered',true);end if;
 if not coalesce((st.data#>>'{settings,storeOpen}')::boolean,false) then raise exception 'La tienda no está tomando pedidos';end if;
 name=trim(payload#>>'{customer,name}');phone=regexp_replace(payload#>>'{customer,phone}','[^0-9]','','g');address=trim(payload#>>'{customer,address}');
 if name is null or length(name) not between 3 and 120 or phone is null or length(phone) not between 8 and 20 or coalesce(name,'')||coalesce(address,'') ~ '[<>]' then raise exception 'Completá nombre, teléfono y domicilio válidos';end if;
 if payload->>'delivery' not in ('pickup','delivery') or (payload->>'delivery'='delivery' and length(coalesce(address,''))<6) then raise exception 'Entrega inválida';end if;
 if payload->>'payment' not in ('cash','transfer','at_pickup') or (payload->>'payment'='transfer' and not coalesce((st.data#>>'{settings,transferEnabled}')::boolean,false)) then raise exception 'Medio de pago no habilitado';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Carrito inválido';end if;
 for item in select value from jsonb_array_elements(payload->'items') loop
 qty=(item->>'qty')::integer;if qty not between 1 and 20 or (item->>'qty')::numeric<>qty or item->>'id'=any(product_ids) then raise exception 'Cantidad o producto repetido inválido';end if;product_ids=array_append(product_ids,item->>'id');
 select value,(ordinality-1)::integer into p,idx from jsonb_array_elements(st.data->'products') with ordinality where value->10->>'id'=item->>'id';m=p->10;
 if p is null or not coalesce((m->>'onlinePublished')::boolean,false) or m->>'status'<>'enabled' or qty>coalesce((m->>'onlineUnits')::integer,0) or qty>(p->>3)::integer or (item->>'expectedPrice')::numeric<>(p->>2)::numeric then raise exception 'Cambió el precio o la disponibilidad. Revisá el carrito.';end if;
 amount=round((p->>2)::numeric*qty,2);subtotal=subtotal+amount;
 rows=rows||jsonb_build_array(jsonb_build_object('id',m->>'id','name',p->>0,'qty',qty,'unitPrice',p->2,'total',amount,'options','{}'::jsonb));flow_items=flow_items||jsonb_build_array(jsonb_build_array(p->>0,qty,p->2));
 m=m||jsonb_build_object('onlineUnits',(m->>'onlineUnits')::integer-qty,'webReserved',coalesce((m->>'webReserved')::integer,0)+qty);
 st.data=jsonb_set(st.data,array['products',idx::text,'10'],m);
 end loop;
 shipping=case when payload->>'delivery'='delivery' then coalesce((st.data#>>'{settings,shipping}')::numeric,0) else 0 end;
 if shipping>0 then flow_items=flow_items||jsonb_build_array(jsonb_build_array('Envío',1,shipping));end if;
 insert into public.remake_web_orders(request_id,token,fingerprint,data) values(req,tok,payload-'requestId'-'token','{}') returning number into num;
 delivery_code=lpad((floor(random()*1000000))::text,6,'0');
 result=jsonb_build_object('id',req,'number',num,'code',tok,'deliveryCode',delivery_code,'createdAt',now(),'customer',jsonb_build_object('name',name,'phone',phone,'email',left(coalesce(payload#>>'{customer,email}',''),160),'address',case when payload->>'delivery'='delivery' then address else '' end),'delivery',payload->>'delivery','payment',payload->>'payment','note',left(coalesce(payload->>'note',''),250),'items',rows,'flowItems',flow_items,'subtotal',subtotal,'shipping',shipping,'total',subtotal+shipping,'status','new','paymentStatus','pending','requestId',req);
 flow=jsonb_build_object('id','#'||num,'backendOrderId',req,'customer',name,'channel','Web','stage','received','status','Nuevo','payment',case when payload->>'payment'='transfer' then 'Transferencia' else 'Efectivo' end,'total',subtotal+shipping,'time',to_char(now() at time zone 'America/Argentina/Buenos_Aires','HH24:MI'),'address',case when payload->>'delivery'='delivery' then address else 'Retira en local' end,'items',flow_items,'createdAt',now(),'branch',st.data#>>'{settings,branch}','paymentConfirmed',false,'dispatchStage','waiting','deliveryCode',delivery_code);
 st.data=jsonb_set(st.data,'{orderFlow}',jsonb_build_array(flow)||(st.data->'orderFlow'));
 update public.remake_web_orders set data=result where request_id=req;
 update public.remake_state set data=st.data,version=version+1,updated_at=now() where id;
 return jsonb_build_object('order',result-'flowItems');
end $$;
create function public.remake_track(order_number bigint, tracking_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if current_setting('role',true)<>'service_role' then raise exception 'Sólo servidor' using errcode='42501';end if;
 select jsonb_build_object('order',data-'flowItems') into result from public.remake_web_orders where number=order_number and token=tracking_token;
 if result is null then raise exception 'No encontramos ese pedido con su código';end if;return result;
end $$;
revoke all on function public.remake_load(),public.remake_next_number(),public.remake_commit(bigint,uuid,jsonb),public.remake_catalog(),public.remake_checkout(jsonb),public.remake_track(bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.remake_load(),public.remake_next_number(),public.remake_commit(bigint,uuid,jsonb) to authenticated;
grant execute on function public.remake_catalog() to anon,authenticated;
grant execute on function public.remake_checkout(jsonb),public.remake_track(bigint,uuid) to service_role;
commit;
