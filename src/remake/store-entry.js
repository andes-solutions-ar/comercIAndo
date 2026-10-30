import { supabase } from "../lib/supabase.js";
import { rpc, edge } from "../services/api.js";
import engine from "./generated/store.js";
import template from "./generated/store-template.js";
window.__remakeStoreAPI = {
  async request(action, payload = {}) {
    if (action === "menu") {
      const menu = await rpc("remake_catalog");
      window.__setStoreCategories?.(menu.categories);
      return menu;
    }
    if (action === "checkout" || action === "track")
      return edge("remake-store", { action, payload });
    throw Error(
      "La administración del comercio requiere ingresar con tu usuario.",
    );
  },
};
if (!supabase)
  document.querySelector("#storeBoot").textContent =
    "La tienda no tiene configurado su backend.";
else {
  const doc = new DOMParser().parseFromString(template.html, "text/html");
  for (const el of doc.head.querySelectorAll('style,link[rel="stylesheet"]'))
    document.head.append(el.cloneNode(true));
  document.body.innerHTML = doc.body.innerHTML;
  const script = document.createElement("script");
  script.textContent = engine;
  document.body.append(script);
  document.querySelector(".demo-strip")?.remove();
  for (const id of ["demoTop", "openDemoFooter"]) {
    const el = document.getElementById(id);
    if (el)
      el.onclick = (ev) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        location.assign("/administracion/");
      };
  }
  // Public order tracking uses an unguessable UUID, independent of the delivery code.
  for (const input of document.querySelectorAll('input[maxlength="6"]')) {
    input.removeAttribute("maxlength");
    input.removeAttribute("pattern");
    input.type = "text";
    input.inputMode = "text";
  }
}

const info = document.getElementById("footerInfo");
if (info)
  info.onclick = (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    window.openModal?.(
      '<div class="modal-head"><h2>Información de la tienda</h2><button data-close aria-label="Cerrar">×</button></div><div class="modal-body"><p>Los pedidos se registran en el servidor del comercio. Los precios y la disponibilidad se verifican al confirmar.</p><p>Los pagos se confirman manualmente. El comprobante es interno y no constituye una factura ni una acreditación bancaria.</p><p>Conservá el número de pedido, el código privado de seguimiento y el código de entrega.</p></div>',
      "info",
    );
  };
