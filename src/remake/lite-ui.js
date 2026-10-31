// Appended to the supplied engine by build-emprendedores.mjs, in its lexical scope.
let changing = false, bufferedToast = null, requestedClose = false;
const localToast = toast, localClose = closeModal, localRender = render;
toast = (message,error=false) => changing ? (bufferedToast=[message,error]) : localToast(message,error);
closeModal = () => changing ? (requestedClose=true) : localClose();
render = () => {
  if(changing) return;
  localRender();
  const profile=window.__remakeBackend.profile;
  document.querySelectorAll('.v8-userbadge b').forEach(el=>el.textContent=profile.full_name);
  document.querySelectorAll('.v8-userbadge small').forEach(el=>el.textContent=profile.access_level==='super_admin'?'Superadministrador':'Administrador');
  document.querySelectorAll('.v8-usercircle,.me .av').forEach(el=>el.textContent=profile.full_name.slice(0,2).toUpperCase());
  if(view==='cfg') {
    const panels=document.querySelectorAll('#v .lite-summary > .v8-panel');
    const panel=panels[1];
    if(panel) {
      const real=document.createElement('div'); real.innerHTML=window.__realUsersView();
      panel.querySelector('.v8-panel-inner').replaceChildren(real);
      panel.querySelector('h2').textContent='Usuarios';
    }
  }
};
function salesChart(){
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d;});
  const totals=days.map(d=>state.sales.filter(s=>s.at&&new Date(s.at).toDateString()===d.toDateString()).reduce((n,s)=>n+s.total,0));
  const max=Math.max(1,...totals);
  return days.map((d,i)=>`<div class="lite-column" title="${esc(money(totals[i]))}" style="height:${Math.max(1,totals[i]/max*100)}%"><span>${d.toLocaleDateString('es-AR',{weekday:'short'})}</span></div>`).join('');
}
async function changeServer(fn, sale=false){
  if(changing)return;
  changing=true;bufferedToast=null;requestedClose=false;
  const before=structuredClone(state),oldCart=structuredClone(cart);
  try{
    if(sale)window.__liteSaleNumber=await window.__remakeBackend.nextNumber();
    fn();
    if(JSON.stringify(before)!==JSON.stringify(state))state=await window.__lite.save(state);
    changing=false;
    if(requestedClose)localClose();
    render(); document.documentElement.dataset.theme=state.theme;
    if(bufferedToast)localToast(...bufferedToast);
  }catch(error){
    state=before;cart=oldCart;changing=false;render();
    localToast(error.message||'No se pudo guardar la operación.',true);
  }finally{changing=false;}
}
document.addEventListener('click',e=>{
  if(changing){e.preventDefault();e.stopImmediatePropagation();return;}
  const button=e.target.closest('button');if(!button||button.disabled)return;
  const code=button.dataset.action||'';
  let mutation=null,sale=false;
  if(button.id==='cashHeader'||code==='toggle-cash')mutation=()=>{state.cash=!state.cash;toast(state.cash?'Caja abierta':'Caja cerrada')};
  const handlers={'save-product':saveProduct,'save-move':saveMove,'save-delivery':saveDelivery,'add-category':addCategory,'save-settings':saveSettings,'confirm-sale':confirmSale};
  if(handlers[code]){mutation=handlers[code];sale=code==='confirm-sale'||code==='save-delivery';}
  if(code.startsWith('edit-category:'))mutation=()=>editCategory(code.slice(14));
  if(code.startsWith('delete-category:'))mutation=()=>deleteCategory(code.slice(16));
  if(code.startsWith('publish:'))mutation=()=>{const p=state.products.find(p=>p.id===Number(code.slice(8)));p.published=!p.published;toast('Visibilidad guardada')};
  if(code.startsWith('advance:'))mutation=()=>{const d=state.deliveries.find(d=>d.id===code.slice(8));if(d.web&&!d.paid)throw Error('El pedido web requiere confirmar su cobro desde la administración de pedidos.');d.status=d.status==='Pendiente'?'En preparación':'Entregado';toast('Estado de entrega guardado')};
  if(code.startsWith('pay-order:')){
    e.preventDefault();e.stopImmediatePropagation();
    const id=code.slice(10),d=state.deliveries.find(d=>d.id===id);
    openModal('Confirmar cobro',`Pedido ${id} · ${d.customer}`,'<p>Confirmá únicamente después de verificar el efectivo o la transferencia. Esta acción registra el cobro manual; no ejecuta un pago bancario.</p>',`<button class="btn g" data-action="close-modal">Volver</button><button class="btn" data-action="confirm-payment:${esc(id)}">Registrar cobro verificado</button>`);
    return;
  }
  if(code.startsWith('confirm-payment:')){
    e.preventDefault();e.stopImmediatePropagation();if(changing)return;
    changing=true;
    window.__lite.payOrder(code.slice(16)).then(saved=>{state=saved;changing=false;localClose();render();localToast('Cobro guardado');}).catch(error=>{changing=false;localToast(error.message,true);});
    return;
  }
  if(code==='new-user'||code==='add-user'){
    e.preventDefault();e.stopImmediatePropagation();window.realInvite();return;
  }
  if(button.dataset.pref){
    mutation=()=>{if(button.dataset.pref==='theme')state.theme=state.theme==='dark'?'light':'dark';else state.sound=!state.sound;};
  }
  if(mutation){e.preventDefault();e.stopImmediatePropagation();void changeServer(mutation,sale);}
},true);
window.toast=toast;window.go=go;
window.workModal=(heading,sub,body)=>openModal(heading,sub,body);
window.workError=message=>toast(message,true);
window.__installRealUsers=()=>{};
window.__getRemakeState=()=>window.__lite.document();
window.__replaceRemakeState=document=>{window.__lite.replace(document);state=window.__lite.state();cart={};closeModal();render();document.documentElement.dataset.theme=state.theme;};
Object.defineProperty(window,'cart',{configurable:true,get:()=>cart});
await window.__remakeBackend.ready();
render();
