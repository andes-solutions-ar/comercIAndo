import { head, button, tile, empty, toast } from "../components/ui.js";
import { money, escapeHtml as e } from "../utils/format.js";
import { totals, change, validateQuantity } from "../utils/business.js";
import { rpc } from "../services/api.js";
import { showTicket } from "./sales.js";
const carts = new WeakMap();
const cartState = (s) => {
  if (!carts.has(s))
    carts.set(s, {
      items: new Map(),
      category: "Todas",
      search: "",
      method: "Efectivo",
      cash: "",
      customer: "Mostrador",
      request_id: crypto.randomUUID(),
      busy: false,
    });
  return carts.get(s);
};
export function posView(s) {
  const c = cartState(s);
  const categories = [
    "Todas",
    ...new Set(s.products.filter((p) => p.active).map((p) => p.category)),
  ];
  return (
    head(
      "Punto de venta",
      "Venta rápida, cobro y actualización de stock desde una misma pantalla.",
      button("Vaciar", "clear-cart", "", "g"),
    ) +
    `<div class="pos"><div><div class="bar"><input class="search" id="posSearch" placeholder="Buscar por nombre…" aria-label="Buscar producto" value="${e(c.search)}"></div><div class="chips">${categories.map((category) => `<button data-category="${e(category)}" class="${category === c.category ? "on" : ""}">${e(category)}</button>`).join("")}</div><div class="grid" id="grid"></div></div><div class="card cart"><div class="ch"><div><h2>Venta actual</h2><p id="cn"></p></div><span class="pill a">NUEVA</span></div><label class="cart-customer">Cliente<input id="customer" maxlength="160" value="${e(c.customer)}"></label><div class="lines" id="lines"></div><div class="tot"><div class="row"><span>Subtotal neto</span><b class="num" id="sub"></b></div><div class="row"><span>IVA incluido (${e(s.settings.tax_rate)}%)</span><span class="num" id="tax"></span></div><div class="row t2"><span>Total</span><b class="num" id="tt"></b></div><div class="pay">${["Efectivo", "Débito", "Digital"].map((method) => `<button data-method="${method}" class="${c.method === method ? "on" : ""}">${method}</button>`).join("")}</div><div class="cash-drawer" id="cashBox"><div class="r-in"><label for="cashIn">Recibe ($):</label><input type="number" min="0" step="0.01" id="cashIn" value="${e(c.cash)}" placeholder="0"></div><div class="r-in"><span>Vuelto:</span><strong class="num" id="cashOut"></strong></div></div><p id="methodNotice" class="muted"></p><button class="btn" id="cobrar">Cobrar venta</button><p id="posError" role="alert"></p></div></div></div>`
  );
}
export function bindPos(s, refresh) {
  const c = cartState(s),
    root = document.querySelector("#v");
  function repaint() {
    const available = s.products.filter(
      (p) =>
        p.active &&
        (c.category === "Todas" || p.category === c.category) &&
        p.name
          .toLocaleLowerCase("es")
          .includes(c.search.toLocaleLowerCase("es")),
    );
    root.querySelector("#grid").innerHTML = available.length
      ? available
          .map(
            (p) =>
              `<button class="pr" data-add="${p.id}" ${p.track_stock && p.available <= 0 ? "disabled" : ""}>${tile(p)}<b>${e(p.name)}</b><small>${e(p.category)}</small><div class="f"><strong class="num">${money(p.price)}</strong><span>${p.track_stock ? p.available + " u." : "Servicio"}</span></div></button>`,
          )
          .join("")
      : empty("Sin productos disponibles.");
    const items = [...c.items].map(([id, quantity]) => ({
      ...s.products.find((p) => p.id === id),
      quantity,
      unit_price: s.products.find((p) => p.id === id)?.price || 0,
    }));
    const total = totals(items, s.settings.tax_rate);
    root.querySelector("#cn").textContent =
      items.reduce((n, i) => n + i.quantity, 0) + " productos";
    const nav = document.querySelector("#nav [data-go=pos]");
    if (nav) {
      let badge = nav.querySelector(".badge-count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge-count";
        nav.append(badge);
      }
      badge.textContent = items.reduce((n, i) => n + i.quantity, 0);
      badge.hidden = !items.length;
    }
    root.querySelector("#lines").innerHTML = items.length
      ? items
          .map(
            (p) =>
              `<div class="ln"><div class="t"><b>${e(p.name)}</b><small>${money(p.price)} c/u</small></div><div class="q"><button data-qty="${p.id}" data-delta="-1" aria-label="Quitar una unidad">−</button><span>${p.quantity}</span><button data-qty="${p.id}" data-delta="1" aria-label="Agregar una unidad">+</button></div><b class="num">${money(p.unit_price * p.quantity)}</b></div>`,
          )
          .join("")
      : empty("Agregá productos para comenzar.");
    for (const [id, value] of [
      ["sub", total.subtotal],
      ["tax", total.tax],
      ["tt", total.total],
    ])
      root.querySelector("#" + id).textContent = money(value);
    root.querySelector("#cashBox").style.display =
      c.method === "Efectivo" ? "flex" : "none";
    root.querySelector("#cashOut").textContent = money(
      Math.max(0, change(c.cash || 0, total.total)),
    );
    root.querySelector("#methodNotice").textContent =
      c.method === "Digital"
        ? "Registro pendiente. La acreditación se confirma manualmente desde Pagos."
        : c.method === "Débito"
          ? "Confirmá primero la aprobación en tu terminal de débito."
          : "";
    root.querySelector("#cobrar").disabled =
      c.busy ||
      !items.length ||
      !c.customer.trim() ||
      (c.method === "Efectivo" && change(c.cash || 0, total.total) < 0);
    root
      .querySelectorAll(
        "#customer,#cashIn,[data-method],[data-category],[data-add],[data-qty]",
      )
      .forEach((el) => {
        el.disabled =
          c.busy ||
          (el.dataset.add &&
            s.products.find((p) => p.id === el.dataset.add)?.track_stock &&
            s.products.find((p) => p.id === el.dataset.add)?.available <= 0);
      });
    root
      .querySelectorAll("[data-method]")
      .forEach((b) => b.classList.toggle("on", b.dataset.method === c.method));
    root
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.classList.toggle("on", b.dataset.category === c.category),
      );
  }
  root.querySelector("#posSearch").oninput = (ev) => {
    c.search = ev.target.value;
    repaint();
  };
  root.querySelector("#customer").oninput = (ev) => {
    c.customer = ev.target.value;
    repaint();
  };
  root.querySelector("#cashIn").oninput = (ev) => {
    c.cash = ev.target.value;
    repaint();
  };
  root.onclick = (ev) => {
    if (c.busy) return;
    try {
      const add = ev.target.closest("[data-add]"),
        qty = ev.target.closest("[data-qty]"),
        method = ev.target.closest("[data-method]"),
        category = ev.target.closest("[data-category]");
      if (add || qty) {
        const id = add?.dataset.add || qty.dataset.qty,
          p = s.products.find((p) => p.id === id);
        const quantity =
          (c.items.get(id) || 0) + (add ? 1 : Number(qty.dataset.delta));
        if (quantity <= 0) c.items.delete(id);
        else c.items.set(id, validateQuantity(p, quantity));
        c.request_id = crypto.randomUUID();
        repaint();
      }
      if (method) {
        c.method = method.dataset.method;
        c.request_id = crypto.randomUUID();
        repaint();
      }
      if (category) {
        c.category = category.dataset.category;
        repaint();
      }
    } catch (error) {
      toast(error.message);
    }
  };
  root.querySelector("#cobrar").onclick = async () => {
    c.busy = true;
    repaint();
    try {
      const sale = await rpc("create_pos_sale", {
        payload: {
          request_id: c.request_id,
          customer_name: c.customer,
          payment_method: c.method,
          cash_received: c.cash || null,
          items: [...c.items].map(([product_id, quantity]) => ({
            product_id,
            quantity,
          })),
        },
      });
      c.items.clear();
      c.cash = "";
      c.request_id = crypto.randomUUID();
      if (s.settings.sound_enabled) beep();
      await refresh();
      await showTicket(sale, s.settings.auto_print);
      toast("Venta registrada");
    } catch (error) {
      if (root.isConnected)
        root.querySelector("#posError").textContent = error.message;
    } finally {
      c.busy = false;
      if (root.querySelector("#cobrar")) repaint();
    }
  };
  repaint();
}
export function clearCart(s, render) {
  const c = cartState(s);
  if (c.busy) return;
  c.items.clear();
  c.cash = "";
  c.request_id = crypto.randomUUID();
  render();
}
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {}
}
