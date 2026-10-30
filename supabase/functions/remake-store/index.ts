import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const key=keys.default||Object.values(keys)[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin=createClient(Deno.env.get('SUPABASE_URL')!,String(key),{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async(req:Request)=>{
 const site=Deno.env.get('SITE_URL')||'',origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':site,'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'};
 const reply=(value:unknown,status=200)=>Response.json(value,{status,headers});
 if(!site)return reply({error:'Falta configurar SITE_URL'},503);
 if(origin&&origin!==site)return reply({error:'Origen no permitido'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 try{
  const raw=await req.text();if(raw.length>20000)return reply({error:'Solicitud demasiado grande'},413);
  const body=JSON.parse(raw),payload=body.payload;
  if(!['checkout','track'].includes(body.action)||!payload||typeof payload!=='object')return reply({error:'Solicitud inválida'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+String(key)));
  const rate_key=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
  const {error:rateError}=await admin.rpc('check_order_rate',{rate_key});if(rateError)return reply({error:'Demasiadas solicitudes. Intentá más tarde.'},429);
  if(body.action==='checkout'&&(!/^[a-f0-9-]{36}$/i.test(payload.requestId)||!/^[a-f0-9-]{36}$/i.test(payload.token)||!Array.isArray(payload.items)||payload.items.length>100))return reply({error:'Pedido inválido'},400);
  if(body.action==='track'&&(!Number.isSafeInteger(Number(payload.number))||Number(payload.number)<1||!/^[a-f0-9-]{36}$/i.test(payload.code)))return reply({error:'Número o código inválido'},400);
  const {data,error}=body.action==='checkout'?await admin.rpc('remake_checkout',{payload}):await admin.rpc('remake_track',{order_number:Number(payload.number),tracking_token:payload.code});
  if(error)return reply({error:error.message},400);return reply(data);
 }catch{return reply({error:'No se pudo procesar la solicitud'},400);}
});
