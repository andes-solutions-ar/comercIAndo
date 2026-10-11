import { head, button, check, tile, empty, toast } from "../components/ui.js";
import { escapeHtml as e, money } from "../utils/format.js";
import { rpc, edge, updateSettings } from "../services/api.js";
export function catalogView(s) {
  const c = s.settings;
  return (
    head(
      "Tienda / catálogo digital",
      "Presencia digital conectada al mismo catálogo administrado.",
      `<a class="btn g" href="/catalogo" target="_blank" rel="noopener">Vista previa</a>` +
        button("Publicar cambios", "save-catalog"),
    ) +
    `<div class="g2"><div class="web-hero"><div><b>${e(c.store_name)} <span>Online</span></b><h2>Todo lo que necesitás, también online.</h2><p>Los productos toman existencia y precios directamente del módulo central.</p></div><div class="web-grid">${
      s.products
        .filter((p) => p.active && p.published)
        .slice(0, 4)
        .map(
          (p) =>
            `<div class="web-item">${tile(p, true)}<div><b>${e(p.name)}</b><small>${money(p.price)}</small></div></div>`,
        )
        .join("") || empty("Publicá productos desde Productos y servicios.")
    }</div></div><form class="card padded" id="catalogForm"><h2>Configuración comercial</h2><div class="settings-switches">${check("Catálogo público", "public_catalog_enabled", c.public_catalog_enabled)}${check("Recibir pedidos web", "web_orders_enabled", c.web_orders_enabled)}${check("Mostrar disponibilidad", "show_availability", c.show_availability)}${check("Pagos online QR", "online_payments_enabled", false, true)}<p class="muted">Pasarela no configurada.</p></div></form></div>`
  );
}
export async function saveCatalog(refresh) {
  const data = new FormData(document.querySelector("#catalogForm"));
  const payload = Object.fromEntries(
    ["public_catalog_enabled", "web_orders_enabled", "show_availability"].map(
      (k) => [k, data.has(k)],
    ),
  );
  if (payload.web_orders_enabled && !payload.public_catalog_enabled)
    throw new Error("Activá el catálogo público antes de recibir pedidos.");
  await updateSettings(payload);
  await refresh();
  toast("Configuración comercial publicada");
}
export async function mountPublicCatalog() {
  const root = document.querySelector("#app");
  root.innerHTML =
    '<div class="auth-screen" role="status">Cargando catálogo…</div>';
  try {
    const data = await rpc("get_public_catalog");
    if (!data || data.enabled === false) {
      root.innerHTML =
        '<div class="auth-screen"><div class="card padded"><h1>Catálogo no disponible</h1><p>El comercio todavía no habilitó su catálogo público.</p></div></div>';
      return;
    }
    const cart = new Map();
    let request_id = crypto.randomUUID(),
      busy = false;
    root.innerHTML = `<div class="public-catalog"><header class="web-hero"><b>${e(data.store_name)} <span>Online</span></b><h1>Todo lo que necesitás, también online.</h1><p>${e(data.business_category)}</p></header><div class="pos"><div><div class="bar"><input class="search" id="catalogSearch" placeholder="Buscar productos…" aria-label="Buscar productos"></div><div class="grid" id="publicProducts"></div></div><div class="card cart padded"><h2>Tu pedido</h2><div id="publicLines"></div><strong id="publicTotal"></strong><label>Nombre<input id="orderName" maxlength="160" autocomplete="name"></label><p class="muted">Pedido pendiente de confirmación y cobro por el comercio.</p><button class="btn" id="sendOrder" ${data.web_orders_enabled ? "" : "disabled"}>${data.web_orders_enabled ? "Enviar pedido" : "Pedidos deshabilitados"}</button><p id="orderResult" role="status"></p></div></div></div>`;
    const grid = root.querySelector("#publicProducts");
    function paint() {
      const term = root
        .querySelector("#catalogSearch")
        .value.toLocaleLowerCase("es");
      grid.innerHTML =
        data.products
          .filter((p) => p.name.toLocaleLowerCase("es").includes(term))
          .map(
            (p) =>
              `<button class="pr" data-public-add="${p.id}" ${!data.web_orders_enabled || (p.track_stock && p.available !== null && p.available <= 0) ? "disabled" : ""}>${tile(p)}<b>${e(p.name)}</b><span class="f"><b>${money(p.price)}</b><small>${p.track_stock && p.available !== null ? p.available + " u." : p.track_stock ? "" : "Servicio"}</small></span></button>`,
          )
          .join("") || empty("No hay productos publicados.");
      root.querySelector("#publicLines").innerHTML =
        [...cart]
          .map(([id, qty]) => {
            const p = data.products.find((p) => p.id === id);
            return `<div class="ln"><div class="t"><b>${e(p.name)}</b><small>${qty} × ${money(p.price)}</small></div><button class="btn g sm" data-public-remove="${id}" aria-label="Quitar producto">✕</button></div>`;
          })
          .join("") || empty("Tu pedido está vacío.");
      root.querySelector("#publicTotal").textContent = money(
        [...cart].reduce(
          (n, [id, q]) =>
            n + Number(data.products.find((p) => p.id === id).price) * q,
          0,
        ),
      );
      root.querySelector("#sendOrder").disabled =
        busy || !data.web_orders_enabled || !cart.size;
    }
    root.querySelector("#catalogSearch").oninput = paint;
    root.onclick = (ev) => {
      const add = ev.target.closest("[data-public-add]"),
        remove = ev.target.closest("[data-public-remove]");
      if (add && !busy) {
        const id = add.dataset.publicAdd,
          p = data.products.find((p) => p.id === id),
          qty = (cart.get(id) || 0) + 1;
        if (p.track_stock && p.available !== null && qty > p.available) {
          toast("No hay más unidades disponibles");
          return;
        }
        cart.set(id, qty);
        request_id = crypto.randomUUID();
        paint();
      }
      if (remove && !busy) {
        cart.delete(remove.dataset.publicRemove);
        request_id = crypto.randomUUID();
        paint();
      }
    };
    root.querySelector("#sendOrder").onclick = async () => {
      const name = root.querySelector("#orderName").value.trim();
      if (!name) {
        root.querySelector("#orderResult").textContent = "Ingresá tu nombre.";
        return;
      }
      busy = true;
      paint();
      try {
        const result = await edge("create-web-order", {
          request_id,
          customer_name: name,
          items: [...cart].map(([product_id, quantity]) => ({
            product_id,
            quantity,
          })),
        });
        cart.clear();
        request_id = crypto.randomUUID();
        root.querySelector("#orderResult").textContent =
          "Pedido recibido. Referencia " +
          result.reference +
          ". El comercio confirmará el cobro y la entrega.";
        const next = await rpc("get_public_catalog");
        if (next?.products) data.products = next.products;
      } catch (error) {
        root.querySelector("#orderResult").textContent = error.message;
      } finally {
        busy = false;
        paint();
      }
    };
    paint();
  } catch (error) {
    root.innerHTML = `<div class="auth-screen"><div class="card padded"><h1>No pudimos cargar el catálogo</h1><p>${e(error.message)}</p><button class="btn" id="retryCatalog">Reintentar</button></div></div>`;
    root.querySelector("#retryCatalog").onclick = mountPublicCatalog;
  }
}
