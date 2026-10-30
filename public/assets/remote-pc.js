/* comercIAndo v2.0 — Complemento de lector móvil P2P (solo prototipo HTML).
   Señalización PeerJS pública; WebRTC DataChannel. NUNCA transmite video ni datos de clientes.
   Se requiere publicar el HTML en HTTPS para QR entre equipos y cámara móvil.
*/
(()=>{'use strict';
  const DEMO=()=>window.__comerciandoDemoRestricted===true;
  const findScanner=()=>window.comerciandoBarcodeV2;
  const $=s=>document.querySelector(s);
  const state={peer:null,conn:null,token:'',expires:0,authorized:false,qrUrl:'',pending:null,timer:0,seen:new Set(),connecting:false,lastValue:'',lastTick:0,purpose:'pos',productInput:null};
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const uid=()=>{const a=new Uint8Array(22);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')};
  const safeSend=obj=>{try{if(state.conn?.open)state.conn.send(obj)}catch{}};
  function announce(msg,kind=''){const el=$('#v2rStatus');if(el){el.textContent=msg;el.className='v2r-status'+(kind==='warning'?' v2r-warning':'')}}
  function countdown(){const left=Math.max(0,Math.ceil((state.expires-Date.now())/1000));const el=$('#v2rClock');if(el)el.textContent=state.authorized?'Vinculado':left?`Expira en ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'QR vencido';if(!left&&!state.authorized&&state.peer){announce('El QR caducó. Generá otro para vincular un celular.','warning');state.conn?.close();state.peer?.destroy();state.peer=null;state.conn=null;state.pending=null;} }
  function createUI(){if($('#v2rScreen'))return;const d=document.createElement('div');d.id='v2rScreen';d.className='v2r-screen';d.hidden=true;d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Vincular escáner móvil');d.innerHTML=`<section class="v2r-dialog"><div class="v2r-top"><div class="v2r-icon">▣</div><div><h2>Vincular escáner móvil</h2><p id="v2rIntro">Usá la cámara del celular para enviar códigos de barras al Punto de Venta.</p></div><button class="v2r-close" id="v2rClose" aria-label="Cerrar">×</button></div><p class="v2r-status" id="v2rStatus">Preparando una conexión segura…</p><div class="v2r-qrarea"><div class="v2r-qr" id="v2rQRCode"><span style="color:#5d6c80;text-align:center;font-size:12px">Preparando QR…</span></div><div><div class="v2r-clock" id="v2rClock">QR temporal</div><p class="v2r-desc" id="v2rSteps">1. Escaneá este QR con la cámara del teléfono.<br>2. Aceptá la conexión desde esta PC.<br>3. Escaneá productos con el teléfono; se agregarán al carrito de esta caja.</p><label class="v2r-desc" for="v2rLink">Enlace alternativo</label><div id="v2rLink" class="v2r-link">Generando enlace…</div><button id="v2rCopy" style="margin-top:7px;background:transparent;border:0;color:#92b6ff;cursor:pointer;font-size:12px">Copiar enlace</button></div></div><div id="v2rRequest" hidden class="v2r-pending"><strong>Solicitud de conexión desde celular</strong><p>Un teléfono desea actuar como escáner. ¿Autorizás el acceso a esta caja?</p><div class="v2r-btns"><button id="v2rReject">Rechazar</button><button class="primary" id="v2rApprove">Autorizar celular</button></div></div><div class="v2r-btns"><button id="v2rRegenerate">Nuevo QR</button><button id="v2rDisconnect" class="danger">Desconectar</button></div><p class="v2r-secure">Solo se envían códigos de productos, nunca imágenes ni video. QR válido 3 minutos. <span id="v2rPurposeNote">El POS controla disponibilidad, precio y autorizaciones.</span>${DEMO()?' Esta es una demo: no se agregan productos al carrito.':''}</p></section>`;document.body.appendChild(d);
    $('#v2rClose').onclick=()=>{d.hidden=true};d.addEventListener('click',e=>{if(e.target===d)d.hidden=true});$('#v2rRegenerate').onclick=()=>initSession();$('#v2rDisconnect').onclick=()=>{stop();announce('Celular desconectado. Generá un nuevo QR para vincular.');};$('#v2rReject').onclick=()=>{safeSend({type:'rejected'});state.conn?.close();state.pending=null;$('#v2rRequest').hidden=true;announce('Solicitud rechazada. El QR sigue activo.');};$('#v2rApprove').onclick=approve;$('#v2rCopy').onclick=()=>{if(state.qrUrl)navigator.clipboard?.writeText(state.qrUrl).then(()=>announce('Enlace copiado. Podés enviarlo al celular.')).catch(()=>announce('Seleccioná y copiá el enlace manualmente.'))};
  }
  function stop(){try{state.conn?.close()}catch{}try{state.peer?.destroy()}catch{}state.peer=null;state.conn=null;state.pending=null;state.authorized=false;state.connecting=false;state.seen.clear();state.expires=0;state.qrUrl='';$('#v2rRequest')&&($('#v2rRequest').hidden=true);updateBtn();}
  async function script(url,check){if(check())return;return new Promise((resolve,reject)=>{const e=document.createElement('script');e.src=url;e.async=true;e.onload=()=>check()?resolve():reject(Error('Biblioteca no disponible'));e.onerror=()=>reject(Error('Sin conexión con la biblioteca'));document.head.appendChild(e)});}
  async function loadPeer(){if(window.Peer)return;await script('https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',()=>!!window.Peer)}
  async function loadQR(){if(window.QRCode)return;await script('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',()=>!!window.QRCode)}
  function updateScopeCopy(){
    const product=state.purpose==='product';
    const intro=$('#v2rIntro');
    if(intro)intro.textContent=product
      ? 'Usá la cámara de tu celular para completar el código de barras del producto que estás cargando en la PC.'
      : 'Usá la cámara del celular para enviar códigos de barras al Punto de Venta.';
    const steps=$('#v2rSteps');
    if(steps)steps.innerHTML=product
      ? '1. Escaneá este QR con el celular.<br>2. Autorizá la conexión desde esta PC.<br>3. Leé el código en el teléfono: se completará el campo Código de barras del formulario.<br>4. Guardá el producto desde la PC.'
      : '1. Escaneá este QR con la cámara del teléfono.<br>2. Aceptá la conexión desde esta PC.<br>3. Escaneá productos con el teléfono; se agregarán al carrito de esta caja.';
    const note=$('#v2rPurposeNote');
    if(note)note.textContent=product
      ? 'Escanear solo completa el formulario. No se crean productos ni se modifica el stock hasta guardar.'
      : 'El POS controla disponibilidad, precio y autorizaciones.';
    const dialog=$('#v2rScreen .v2r-top h2');
    if(dialog)dialog.textContent=product?'Escanear producto con celular':'Vincular escáner móvil';
  }
  function updateBtn(){const b=$('#v2rPairButton');if(!b)return;b.classList.toggle('v2r-live',state.authorized);b.textContent=state.authorized?'● Celular conectado':'▣ Vincular celular';}
  function show(mode='pos'){
    createUI();
    const purpose=mode==='product'?'product':'pos';
    if(purpose==='product'){
      const modal=$('#modalProduct'),input=$('#npBarcode');
      if(!modal?.classList.contains('open')||!input){
        window.toast?.('Abrí el formulario Nuevo producto para escanear desde el celular.');
        return;
      }
      state.productInput=input;
    }else state.productInput=null;
    const changed=state.purpose!==purpose;
    state.purpose=purpose;
    updateScopeCopy();
    $('#v2rScreen').hidden=false;
    if(changed||!state.peer)initSession();
    else updateBtn();
  }
  function tryAttach(){const bar=$('.v20-scanbar');if(!bar||bar.querySelector('#v2rPairButton'))return;const b=document.createElement('button');b.id='v2rPairButton';b.type='button';b.className='v2r-pair-btn';b.textContent=state.authorized?'● Celular conectado':'▣ Vincular celular';b.title='Abrir QR temporal para vincular un teléfono';b.addEventListener('click',()=>show('pos'));const last=bar.querySelector('#v20Link')||bar.querySelector('.v20-hint');bar.insertBefore(b,last||null);}
  function showURL(){const q=$('#v2rQRCode');if(!q)return;q.textContent='';const link=$('#v2rLink');if(link)link.textContent=state.qrUrl;if(!state.qrUrl)return;loadQR().then(()=>{if(!state.qrUrl||!q.isConnected)return;q.textContent='';new QRCode(q,{text:state.qrUrl,width:182,height:182,correctLevel:QRCode.CorrectLevel.M});}).catch(()=>{q.innerHTML='<span style="color:#3d5269;font-size:12px;text-align:center">QR no disponible.<br>Copiá el enlace alternativo.</span>'});}
  async function initSession(){createUI();stop();$('#v2rScreen').hidden=false;$('#v2rQRCode').textContent='Conectando…';$('#v2rLink').textContent='Preparando…';announce('Contactando el servicio de vinculación…');if(!window.isSecureContext||location.protocol==='file:'){announce('Para conectar la cámara del celular publicá estas páginas en HTTPS. El archivo local no genera un enlace que el celular pueda abrir.','warning');return;}
    if(!findScanner()){announce('El lector de códigos no está disponible. Actualizá la página.','warning');return;}
    try{await loadPeer();state.token=uid();state.expires=Date.now()+180000;const peer=new window.Peer(undefined,{debug:0});state.peer=peer;
      peer.on('open',id=>{if(state.peer!==peer)return;const url=new URL('scanner-movil.html',document.baseURI);url.searchParams.set('pc',id);url.searchParams.set('token',state.token);url.searchParams.set('exp',String(state.expires));if(DEMO())url.searchParams.set('demo','1');state.qrUrl=url.href;showURL();countdown();announce('QR listo. Abrilo con el celular y autorizá la vinculación desde esta PC.');});
      peer.on('connection',conn=>handleConnection(conn));peer.on('error',err=>announce('No se pudo establecer la conexión: '+(err?.type||err?.message||'error')+'. Revisá Internet o generá otro QR.','warning'));
      peer.on('disconnected',()=>{if(!state.authorized)announce('Se interrumpió la señalización. Podés regenerar el QR.','warning')});
    }catch(e){announce('Error al preparar el enlace: '+(e.message||e),'warning')}
  }
  function handleConnection(conn){if(Date.now()>state.expires||state.authorized||state.conn){conn.close();return;}state.conn=conn;conn.on('data',m=>receive(m,conn));conn.on('close',()=>{if(state.conn===conn){state.conn=null;state.authorized=false;state.pending=null;$('#v2rRequest').hidden=true;updateBtn();announce('El teléfono se desconectó. Generá un QR nuevo para volver a conectar.')}});conn.on('error',()=>announce('La conexión con el teléfono tuvo un error.','warning'));
  }
  function receive(m,conn){if(!m||typeof m!=='object'||conn!==state.conn)return;
    if(m.type==='hello'){if(m.token!==state.token||Date.now()>state.expires||state.authorized){safeSend({type:'rejected',message:'Vinculación vencida o no autorizada'});conn.close();return;}state.pending=conn;$('#v2rRequest').hidden=false;announce('Un celular está esperando autorización. Revisá la solicitud.');return;}
    if(m.type==='scan'){if(!state.authorized||m.token!==state.token||typeof m.code!=='string')return;processScan(m);return;}
    if(m.type==='bye'){stop();announce('Sesión finalizada desde el celular.');}
  }
  function approve(){if(!state.pending||Date.now()>state.expires)return announce('La vinculación venció. Generá otro QR.','warning');state.authorized=true;$('#v2rRequest').hidden=true;safeSend({type:'approved',demo:DEMO(),purpose:state.purpose,message:'Celular autorizado. Iniciá la cámara y escaneá.'});announce(DEMO()?'Celular vinculado para consultas de la demo.':state.purpose==='product'?'Celular vinculado. Escaneá el código; se completará el campo del formulario.':'Celular vinculado. Los códigos leídos se enviarán al Punto de Venta.');updateBtn();}
  function processScan(m){const req=String(m.requestId||'').slice(0,72);const raw=String(m.code||'').trim();if(!req||state.seen.has(req))return;state.seen.add(req);if(state.seen.size>140)state.seen.clear();const reply=(status,message,extra={})=>safeSend({type:'result',requestId:req,status,message,...extra});
    if(!/^[a-zA-Z0-9._-]{4,80}$/.test(raw))return reply('error','Código inválido. Probá otro código de barras.');
    if(state.purpose==='product'){
      const input=state.productInput;
      const form=$('#formProduct');
      const modal=$('#modalProduct');
      if(!form||!modal?.classList.contains('open')||!input?.isConnected||input!==$('#npBarcode'))
        return reply('error','El formulario Nuevo producto ya no está abierto. Volvé a vincular desde la PC.');
      const api=findScanner();
      if(!api)return reply('error','No está disponible la búsqueda de códigos de barras.');
      const hit=api.find(raw);
      if(hit){
        const internal=$('#npCode')?.value?.trim();
        const own=hit.kind==='unit'&&$('#npCode')?.readOnly&&hit.meta?.code===internal;
        if(!own)return reply('warning','El código ya está vinculado con otro producto o una presentación.',{name:hit.product?.[0]||'Código en uso'});
      }
      input.value=raw;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      announce('✓ Código '+raw+' recibido del celular. Completá los datos y guardá el producto.');
      if($('#v2rScreen'))$('#v2rScreen').hidden=true;
      return reply('ok','Código cargado en el formulario de la PC. Guardá el producto para confirmar.',{name:'Código '+raw,price:0});
    }
    if(typeof view==='undefined'||view!=='pos')return reply('error','Abrí Punto de Venta en la PC para agregar productos.');
    const api=findScanner();if(!api)return reply('error','El escáner del POS no está disponible.');
    const hit=api.find(raw);if(!hit)return reply('error','Producto no registrado. Buscalo o vinculá su código en Stock.');
    if(hit.kind!=='unit')return reply('warning','Es una presentación de proveedor; no se agregó al carrito.');
    const p=hit.product;let before=0;try{before=Number(cart[P.indexOf(p)]||0)}catch{}
    if(!DEMO()){try{if(Number(posAuthorizedQty(p))<=before)return reply('warning','No hay cupo autorizado o disponibilidad suficiente.',{name:p[0]});}catch{}}
    try{api.scan(raw,'remote')}catch(e){return reply('error','No se pudo procesar el código desde el POS.');}
    let after=before;try{after=Number(cart[P.indexOf(p)]||0)}catch{}
    const price=Number(p[2]||0);reply(DEMO()?'demo':after>before?'ok':'warning',DEMO()?'Producto identificado (demo; no modifica el carrito).':after>before?'Producto agregado al carrito de la PC.':'No se agregó la unidad.',{name:String(p[0]),price,quantity:after});
    if(after>before){announce('✓ '+p[0]+' agregado desde celular. Cantidad en carrito: '+after);const d=$('#v2rScreen');if(d)d.hidden=true;}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#v2rScreen')&&!$('#v2rScreen').hidden)$('#v2rScreen').hidden=true;});
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.authorized)announce('La sesión permanece vinculada. Volvé a Punto de Venta para recibir lecturas.');});
  const obs=new MutationObserver(tryAttach);const target=$('#v')||document.body;obs.observe(target,{childList:true,subtree:true});tryAttach();
  state.timer=setInterval(countdown,1000);
  window.comerciandoRemoteScanner={open:()=>show('pos'),openForProduct:()=>show('product'),stop,get connected(){return state.authorized}};
})();
