import './styles.css';
import './lib/supabase.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=n=>'$ '+n.toLocaleString('es-AR');
const I={home:'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',pos:'M4 5h16v10H4zM8 19h8M12 15v4',sales:'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',pay:'M3 6h18v12H3zM3 10h18',web:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',prod:'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',stock:'M4 20V10M10 20V4M16 20v-7M22 20H2',ship:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4',user:'M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1a3 3 0 0 0-2-2.8',mod:'M12 3v18M3 12h18',cfg:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.5a7 7 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.5a7 7 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z'};
const ic=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${I[k]}"/></svg>`;
const NAV=[['',[['home','Inicio']]],['Operación',[['pos','Punto de venta'],['sales','Ventas y pedidos'],['pay','Pagos']]],['Productos',[['web','Tienda / catálogo'],['prod','Productos y servicios'],['stock','Stock Pro'],['ship','Entrega segura']]],['Administración',[['user','Usuarios'],['mod','Módulo empresarial'],['cfg','Configuración']]]];
const NAMES={};NAV.forEach(g=>g[1].forEach(i=>NAMES[i[0]]=i[1]));

const P=[
['Yerba Playadito 1 kg','Almacén',5800,42,12,215],['Aceite girasol 900 ml','Almacén',3200,9,15,230],['Fideos tirabuzón 500 g','Almacén',1450,64,20,25],['Arroz largo fino 1 kg','Almacén',2100,31,15,170],
['Coca-Cola 2,25 L','Bebidas',3900,48,24,5],['Agua mineral 2 L','Bebidas',1600,7,18,200],['Cerveza Andes lata','Bebidas',1800,120,36,40],['Vino Malbec 750 ml','Bebidas',7400,18,10,340],
['Leche entera 1 L','Lácteos',1700,22,20,210],['Queso cremoso kg','Lácteos',9800,6,5,45],['Yogur firme 190 g','Lácteos',980,3,12,320],
['Detergente 750 ml','Limpieza',2600,26,10,265],['Lavandina 1 L','Limpieza',1200,35,12,185]];
const CATS=['Todas',...new Set(P.map(p=>p[1]))];
const tile=p=>{const h=p[5];return `<div class="tile" style="background:hsl(${h} 70% 92%);color:hsl(${h} 55% 32%)">${p[0].split(' ').slice(0,2).map(w=>w[0]).join('')}</div>`};
const crit=p=>p[3]<=p[4];

const HOURS=[['9',48],['10',92],['11',138],['12',171],['13',124],['14',96],['15',142],['16',187],['17',121],['18',88],['19',77]];
const VENTAS=[['#1042','Marina López','POS','$ 18.400','Efectivo','Cobrada','19:12'],['#1041','Tienda online','Web','$ 42.150','Digital','Pedido','18:47'],['#1040','Consumidor final','POS','$ 6.900','Débito','Cobrada','18:30'],['#1039','Kiosco El Cóndor','Web','$ 96.300','Digital','Pendiente','17:55'],['#1038','Juan Pérez','POS','$ 11.250','Efectivo','Cobrada','17:21'],['#1037','Almacén Los Pinos','Web','$ 58.700','Digital','Pedido','16:40']];
const ST={Cobrada:'',Pendiente:'w',Pedido:'a'};
const MOV=[['Entrada','Aceite girasol 900 ml','+24','OC-0192','Marina L.','16:02'],['Salida','Yerba Playadito 1 kg','−6','Venta #1038','Caja 1','17:21'],['Salida','Agua mineral 2 L','−12','Pedido #1041','Web','18:47'],['Entrada','Queso cremoso kg','+10','OC-0194','Juan P.','11:15']];

let view='home',cat='Todas',cart={},pay='Efectivo';

function renderNav(){$('#nav').innerHTML=NAV.map(([g,it])=>(g?`<div class="grp">${g}</div>`:'')+it.map(([k,n])=>`<button data-v="${k}" class="${k==view?'on':''}">${ic(k)}${n}</button>`).join('')).join('')}
function go(v){view=v;renderNav();$('#side').classList.remove('open');$('#crumb').innerHTML=`ComercIAndo Premium · <b>${NAMES[v]}</b>`;$('#v').innerHTML=(V[v]||V.ph)();$('#m').scrollTo(0,0);if(v=='home')chart();if(v=='pos')pos()}
function head(t,s,r=''){return `<div class="hd"><div><h1>${t}</h1><p>${s}</p></div><div class="r">${r}</div></div>`}
const nv=`<button class="btn" data-go="pos">+ Nueva venta</button>`;

const V={
home(){const c=P.filter(crit);return head('Resumen del negocio','Tu operación comercial en una sola vista.',`<span class="pill"><i></i>Operativo</span>${nv}`)+
`<div class="card kpis"><div><span>Ventas de hoy</span><strong class="num">$ 1.284.000</strong><small><span class="up">▲ 12,4%</span> vs. ayer</small></div><div><span>Operaciones</span><strong class="num">63</strong><small>Ticket prom. $ 20.381</small></div><div><span>Stock crítico</span><strong class="num">${c.length}</strong><small>Requieren atención</small></div><div><span>Entregas</span><strong class="num">4</strong><small>Pendientes de completar</small></div></div>
<div class="g2"><div class="card"><div class="ch"><div><h2>Ventas por hora</h2><p>Actividad registrada durante la jornada.</p></div><span class="pill m">HOY</span></div><div id="chart"></div></div>
<div class="card"><div class="ch"><div><h2>Atajos</h2><p>Acciones frecuentes.</p></div></div><div class="sc">${[['pos','Nueva venta','Abrir punto de venta'],['prod','Nuevo producto','Gestionar catálogo'],['stock','Movimiento de stock','Registrar entrada o salida'],['ship','Entregas','Ver pendientes']].map(a=>`<button data-go="${a[0]}"><span class="ic">${ic(a[0])}</span><span><b>${a[1]}</b><small>${a[2]}</small></span></button>`).join('')}</div></div></div>
<div class="g2"><div class="card"><div class="ch"><div><h2>Stock que requiere atención</h2><p>Productos por debajo o cerca del mínimo.</p></div><button class="btn g" data-go="stock">Ver stock</button></div><div style="padding-top:12px">${stk(c)}</div></div>
<div class="card"><div class="ch"><div><h2>Actividad reciente</h2><p>Últimos movimientos del sistema.</p></div></div><div class="act">${[['var(--ok)','Venta #1042 cobrada','19:12'],['var(--ac)','Pedido web #1041 recibido','18:47'],['var(--warn)','Yogur firme bajo el mínimo','18:20'],['var(--ok)','Pago digital acreditado','17:58']].map(a=>`<div><i class="dot" style="background:${a[0]}"></i><span>${a[1]}</span><time>${a[2]}</time></div>`).join('')}</div></div></div>`},
pos(){return head('Punto de venta','Venta rápida, cobro y actualización de stock desde una misma pantalla.',`<span class="pill"><i></i>CAJA ABIERTA</span><button class="btn g" id="clr">Vaciar</button>`)+
`<div class="pos"><div><div class="chips">${CATS.map(c=>`<button data-c="${c}" class="${c==cat?'on':''}">${c}</button>`).join('')}</div><div class="grid" id="grid"></div></div>
<div class="card cart"><div class="ch"><div><h2>Venta actual</h2><p id="cn">0 productos</p></div><span class="pill a">NUEVA</span></div><div class="lines" id="lines"></div><div class="tot"><div class="row"><span>Subtotal</span><b class="num" id="sub">$ 0</b></div><div class="row t2"><span>Total</span><b class="num" id="tt">$ 0</b></div><div class="pay">${['Efectivo','Débito','Digital'].map(p=>`<button data-p="${p}" class="${p==pay?'on':''}">${p}</button>`).join('')}</div><button class="btn" id="cobrar" disabled>Cobrar venta</button></div></div></div>`},
sales(){return head('Ventas y pedidos','Operaciones generadas desde POS y canal digital.',nv)+`<div class="card kpis">${[['Cobradas hoy','$ 1.071.500','47 operaciones'],['Pedidos activos','11','En proceso'],['Ticket promedio','$ 20.381','Jornada actual'],['Pendientes de cobro','5','Revisar']].map(k=>`<div><span>${k[0]}</span><strong class="num">${k[1]}</strong><small>${k[2]}</small></div>`).join('')}</div>
<div class="bar"><select><option>Todos los estados</option><option>Cobrada</option><option>Pendiente</option><option>Pedido</option></select></div><div class="card"><table><thead><tr><th>Operación</th><th>Cliente</th><th>Canal</th><th class="r">Total</th><th>Pago</th><th>Estado</th><th>Hora</th></tr></thead><tbody>${VENTAS.map(v=>`<tr><td><b>${v[0]}</b></td><td>${v[1]}</td><td>${v[2]}</td><td class="r num">${v[3]}</td><td>${v[4]}</td><td><span class="pill ${ST[v[5]]}">${v[5]}</span></td><td class="num">${v[6]}</td></tr>`).join('')}</tbody></table></div>`},
stock(){const c=P.filter(crit).length;return head('Stock Pro','Control profesional de existencias, reservas y movimientos.',`<span class="pill a">Stock Pro activo</span><button class="btn" data-toast="Movimiento registrado">+ Registrar movimiento</button>`)+`<div class="card kpis">${[['Productos controlados',P.length,'Inventario activo'],['Stock crítico',c,'Bajo mínimo'],['Reservado','38','Unidades comprometidas'],['Movimientos hoy','27','Entradas y salidas']].map(k=>`<div><span>${k[0]}</span><strong class="num">${k[1]}</strong><small>${k[2]}</small></div>`).join('')}</div><div class="card" style="margin-bottom:18px"><div style="padding-top:8px">${stk(P)}</div></div>
<div class="card"><div class="ch"><div><h2>Últimos movimientos</h2><p>Trazabilidad operativa del inventario.</p></div></div><div style="padding-top:12px"><table><thead><tr><th>Hora</th><th>Producto</th><th>Movimiento</th><th class="r">Cantidad</th><th>Referencia</th><th>Responsable</th></tr></thead><tbody>${MOV.map(m=>`<tr><td class="num">${m[5]}</td><td>${m[1]}</td><td><span class="pill ${m[0]=='Entrada'?'':'w'}">${m[0]}</span></td><td class="r num">${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td></tr>`).join('')}</tbody></table></div></div>`},
ph(){return head(NAMES[view],'Vista no incluida en este mockup.')+`<div class="card ph"><h2>Esta sección sigue el mismo sistema visual</h2><p>Probá Inicio, Punto de venta, Ventas y pedidos o Stock Pro.</p></div>`}
};

function stk(list){return `<table><thead><tr><th>Producto</th><th class="r">Disponible</th><th class="r">Mínimo</th><th>Nivel</th></tr></thead><tbody>${list.map(p=>{const r=Math.min(p[3]/(p[4]*2),1),c=crit(p);return `<tr><td><b>${p[0]}</b></td><td class="r num">${p[3]}</td><td class="r num">${p[4]}</td><td><span class="lv"><i style="width:${r*100}%;background:${c?'var(--bad)':r<.7?'var(--warn)':'var(--ok)'}"></i></span><span class="pill ${c?'b':''}">${c?'Crítico':'Normal'}</span></td></tr>`}).join('')}</tbody></table>`}

function chart(){const W=640,H=230,pl=34,pb=26,max=200,bw=34,gap=(W-pl-bw*HOURS.length)/(HOURS.length-1);const peak=Math.max(...HOURS.map(h=>h[1]));
let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas por hora">`;
[0,100,200].forEach(v=>{const y=H-pb-(H-pb-10)*v/max;s+=`<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="0" y="${y+4}" font-size="11" fill="var(--mute)">${v?'$'+v+'k':'0'}</text>`});
HOURS.forEach((h,i)=>{const x=pl+i*(bw+gap),bh=(H-pb-10)*h[1]/max,y=H-pb-bh,on=h[1]==peak;s+=`<g><title>${h[0]}:00 — $ ${h[1]}.000</title><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="${on?'var(--ac)':'var(--acs)'}" ${on?'':'stroke="var(--ac)" stroke-opacity=".25"'}/>${on?`<text x="${x+bw/2}" y="${y-8}" font-size="12" font-weight="700" text-anchor="middle" fill="var(--ink)">$ ${h[1]}k</text>`:''}<text x="${x+bw/2}" y="${H-7}" font-size="11.5" text-anchor="middle" fill="var(--mute)">${h[0]}</text></g>`});
$('#chart').innerHTML=s+'</svg>'}

function pos(){const g=$('#grid');g.innerHTML=P.filter(p=>cat=='Todas'||p[1]==cat).map(p=>{const i=P.indexOf(p);return `<button class="pr" data-add="${i}">${tile(p)}<b>${p[0]}</b><span class="f"><b class="num">${fmt(p[2])}</b><small class="num" style="${crit(p)?'color:var(--bad)':''}">${p[3]} u.</small></span></button>`}).join('');cartR()}
function cartR(){const ids=Object.keys(cart),n=ids.reduce((a,i)=>a+cart[i],0),t=ids.reduce((a,i)=>a+cart[i]*P[i][2],0);
$('#cn').textContent=n+(n==1?' producto':' productos');
$('#lines').innerHTML=ids.length?ids.map(i=>`<div class="ln">${tile(P[i]).replace('height:64px','height:38px;width:38px;font-size:13px;flex:none')}<div class="t"><b>${P[i][0]}</b><small class="num">${fmt(P[i][2])} c/u</small></div><div class="q"><button data-q="${i}" data-d="-1" aria-label="Quitar">−</button><span class="num">${cart[i]}</span><button data-q="${i}" data-d="1" aria-label="Agregar">+</button></div></div>`).join(''):`<div class="empty">Tocá un producto para empezar la venta.</div>`;
$('#sub').textContent=$('#tt').textContent=fmt(t);$('#cobrar').disabled=!n}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._);t._=setTimeout(()=>t.classList.remove('on'),2200)}

document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
if(t.dataset.v)go(t.dataset.v);
else if(t.dataset.go)go(t.dataset.go);
else if(t.dataset.t){document.documentElement.dataset.theme=t.dataset.t;$$('.seg button').forEach(b=>b.classList.toggle('on',b==t));if(view=='home')chart()}
else if(t.dataset.c){cat=t.dataset.c;$$('.chips button').forEach(b=>b.classList.toggle('on',b==t));pos()}
else if(t.dataset.add){cart[t.dataset.add]=(cart[t.dataset.add]||0)+1;cartR()}
else if(t.dataset.q){const i=t.dataset.q;cart[i]+=+t.dataset.d;if(cart[i]<1)delete cart[i];cartR()}
else if(t.dataset.p){pay=t.dataset.p;$$('.pay button').forEach(b=>b.classList.toggle('on',b==t))}
else if(t.id=='clr'){cart={};cartR()}
else if(t.id=='cobrar'){const tot=$('#tt').textContent;cart={};cartR();toast(`Venta cobrada · ${tot} · ${pay}`)}
else if(t.dataset.toast)toast(t.dataset.toast);
else if(t.id=='bg')$('#side').classList.toggle('open')});
go('home');
if(matchMedia('(prefers-color-scheme:dark)').matches)$('.seg [data-t=dark]').click();
