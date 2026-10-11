import { shell } from "./components/shell.js";
import { NAV, ic } from "./components/navigation.js";
import { allowed } from "./auth/guard.js";
import { query, rpc } from "./services/api.js";
import { supabase } from "./lib/supabase.js";
import { escapeHtml as e } from "./utils/format.js";
import {
  productsView,
  stockView,
  productDialog,
  moveDialog,
} from "./views/inventory.js";
import { toast, modal } from "./components/ui.js";
import { posView, bindPos, clearCart } from "./views/pos.js";
import {
  salesView,
  paymentsView,
  showTicket,
  confirmPaymentDialog,
  deliveriesView,
} from "./views/sales.js";
import {
  settingsView,
  saveSettings,
  usersView,
  userDialog,
} from "./views/settings.js";
import {
  businessView,
  quoteDialog,
  viewQuote,
  staffDialog,
  shiftDialog,
} from "./views/business-module.js";
import { dashboardView } from "./views/dashboard.js";
import { catalogView, saveCatalog } from "./views/catalog.js";
import { updateSettings } from "./services/api.js";
const permissions = {
  home: "dashboard",
  pos: "pos",
  sales: "sales",
  pay: "payments",
  web: "catalog",
  prod: "products",
  stock: "stock",
  ship: "deliveries",
  user: "users",
  mod: "module",
  cfg: "settings",
};
export async function mountApplication(profile) {
  document.querySelector("#app").innerHTML = shell;
  const viewRoot = document.querySelector("#v");
  const s = {
    profile,
    products: [],
    sales: [],
    payments: [],
    movements: [],
    deliveries: [],
    profiles: [],
    quotes: [],
    staff: [],
    shifts: [],
    invitations: [],
    settings: {},
  };
  const can = (p) => allowed(profile, p);
  let view = Object.keys(permissions).find((k) => can(permissions[k]));
  document.querySelector("#nav").innerHTML =
    NAV.map(
      ([group, items]) =>
        `<div>${group ? `<div class="grp">${e(group)}</div>` : ""}${items
          .filter(([key]) => can(permissions[key]))
          .map(
            ([key, label]) =>
              `<button data-go="${key}">${ic(key)}<span>${e(label)}</span></button>`,
          )
          .join("")}</div>`,
    ).join("") + '<button data-action="logout">Cerrar sesión</button>';
  document.querySelector("#bg").onclick = () =>
    document.querySelector("#side").classList.toggle("open");
  document.querySelector("#userAv").textContent = profile.full_name
    .slice(0, 2)
    .toUpperCase();
  document.querySelector(".me small").textContent = profile.display_role;
  function theme(value) {
    document.documentElement.dataset.theme = value;
    localStorage.setItem("comerciando_theme", value);
    document
      .querySelectorAll("[data-t]")
      .forEach((b) => b.classList.toggle("on", b.dataset.t === value));
  }
  theme(
    localStorage.getItem("comerciando_theme") === "dark" ? "dark" : "light",
  );
  document
    .querySelectorAll("[data-t]")
    .forEach((b) => (b.onclick = () => theme(b.dataset.t)));
  document.querySelector("#btnSound").disabled = !can("settings");
  document.querySelector("#btnSound").onclick = async () => {
    try {
      await updateSettings({ sound_enabled: !s.settings.sound_enabled });
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  };
  function render() {
    if (!viewRoot.isConnected) return;
    document
      .querySelectorAll("[data-go]")
      .forEach((b) => b.classList.toggle("on", b.dataset.go === view));
    document.querySelector("#crumb").textContent =
      "ComercIAndo Premium · " +
      (NAV.flatMap((g) => g[1]).find((i) => i[0] === view)?.[1] ||
        "Sin módulos");
    viewRoot.innerHTML = renderView(view, s);
    bindView(view, s, refresh, render);
  }
  async function refresh() {
    const settings = await query("app_settings");
    s.settings = settings[0];
    if (!s.settings)
      throw new Error("Falta la configuración inicial del negocio.");
    const jobs = [];
    const fetch = (key, table, enabled = true) => {
      if (enabled)
        jobs.push(
          query(table).then((rows) => {
            s[key] = rows.sort((a, b) =>
              (b.created_at || "").localeCompare(a.created_at || ""),
            );
          }),
        );
    };
    fetch(
      "products",
      "products",
      ["products", "pos", "stock", "catalog", "dashboard", "module"].some(can),
    );
    fetch(
      "sales",
      "sales",
      ["sales", "payments", "deliveries", "dashboard", "pos"].some(can),
    );
    fetch("payments", "payments", ["payments", "dashboard"].some(can));
    fetch("movements", "stock_movements", ["stock", "dashboard"].some(can));
    fetch("deliveries", "deliveries", ["deliveries", "dashboard"].some(can));
    fetch("profiles", "profiles", true);
    fetch("invitations", "user_invitations", can("users"));
    fetch("quotes", "quotes", can("module"));
    fetch("staff", "staff_members", can("module"));
    fetch("shifts", "shifts", can("module"));
    await Promise.all(jobs);
    if (s.products.length) {
      const inventory = await rpc("inventory");
      s.products = s.products.map((p) => ({
        ...p,
        ...inventory.find((i) => i.product_id === p.id),
      }));
    }
    if (!viewRoot.isConnected) return;
    document.querySelector("#storeNameSide").textContent =
      s.settings.store_name;
    document.querySelector("#btnSound").textContent = s.settings.sound_enabled
      ? "🔊"
      : "🔇";
    document.querySelector("#btnSound").title = s.settings.sound_enabled
      ? "Sonido de caja activo"
      : "Sonido de caja desactivado";
    const stockNav = document.querySelector("#nav [data-go=stock]");
    if (stockNav) {
      stockNav.querySelector(".badge-count")?.remove();
      const count = s.products.filter(
        (p) => p.active && p.track_stock && p.available <= p.minimum_stock,
      ).length;
      if (count) {
        const badge = document.createElement("span");
        badge.className = "badge-count";
        badge.textContent = count;
        stockNav.append(badge);
      }
    }
    render();
  }
  document.querySelector("#app").onclick = async (ev) => {
    const go = ev.target.closest("[data-go]");
    if (go && can(permissions[go.dataset.go])) {
      view = go.dataset.go;
      document.querySelector("#side").classList.remove("open");
      render();
      return;
    }
    const action = ev.target.closest("[data-action]");
    if (!action) return;
    try {
      if (action.dataset.action === "logout") {
        await supabase.auth.signOut();
        return;
      }
      if (action.dataset.action === "new-product") productDialog(s, refresh);
      else if (action.dataset.action === "edit-product")
        productDialog(s, refresh, action.dataset.id);
      else if (action.dataset.action === "new-move") moveDialog(s, refresh);
      else if (action.dataset.action === "go-pos" && can("pos")) {
        view = "pos";
        render();
      } else await handleAction(action, s, refresh, render);
    } catch (error) {
      toast(error.message);
    }
  };
  viewRoot.textContent = "Cargando datos del negocio…";
  await refresh();
}
const renderView = (view, s) =>
  ({
    home: dashboardView,
    prod: productsView,
    stock: stockView,
    pos: posView,
    sales: salesView,
    pay: paymentsView,
    ship: deliveriesView,
    cfg: settingsView,
    user: usersView,
    mod: businessView,
    web: catalogView,
  })[view]?.(s) ||
  '<div class="card empty">Tu usuario todavía no tiene módulos asignados. Contactá a Andes Solutions.</div>';
const bindView = (view, s, refresh, render) => {
  if (view === "pos") bindPos(s, refresh);
  const filter = () => {
    const term = (
        document.querySelector("[data-filter]")?.value || ""
      ).toLocaleLowerCase("es"),
      status = document.querySelector("#salesStatus")?.value || "";
    document
      .querySelectorAll("#v tbody tr")
      .forEach(
        (tr) =>
          (tr.hidden =
            !tr.textContent.toLocaleLowerCase("es").includes(term) ||
            (status &&
              !tr
                .querySelector("td:nth-child(6)")
                ?.textContent.includes(status))),
      );
  };
  document.querySelector("[data-filter]")?.addEventListener("input", filter);
  document.querySelector("#salesStatus")?.addEventListener("change", filter);
};
const handleAction = async (button, s, refresh, render) => {
  const action = button.dataset.action,
    id = button.dataset.id;
  if (action === "clear-cart") clearCart(s, render);
  else if (action === "ticket") await showTicket(id);
  else if (action === "confirm-payment") confirmPaymentDialog(id, refresh);
  else if (action === "advance-delivery") {
    button.disabled = true;
    try {
      await rpc("advance_delivery", { delivery: id });
      await refresh();
      toast("Entrega actualizada");
    } finally {
      button.disabled = false;
    }
  } else if (action === "cancel-order")
    modal(
      "Cancelar pedido",
      "<p>Se liberarán las reservas de stock de este pedido.</p>",
      async () => {
        await rpc("cancel_web_order", { sale: id });
        await refresh();
      },
    );
  else if (action === "save-settings") await saveSettings(s, refresh);
  else if (action === "save-catalog") await saveCatalog(refresh);
  else if (action === "invite-user") userDialog(s, refresh);
  else if (action === "edit-admin") userDialog(s, refresh, id);
  else if (action === "new-quote") quoteDialog(s, refresh);
  else if (action === "view-quote") await viewQuote(id);
  else if (action === "accept-quote") {
    await rpc("accept_quote", { quote: id });
    await refresh();
    toast("Presupuesto aceptado");
  } else if (action === "new-staff") staffDialog(s, refresh);
  else if (action === "edit-staff") staffDialog(s, refresh, id);
  else if (action === "new-shift") shiftDialog(s, refresh);
  else if (action === "complete-shift" || action === "cancel-shift") {
    await rpc("save_shift", {
      payload: {
        id,
        status: action === "complete-shift" ? "Completado" : "Cancelado",
      },
    });
    await refresh();
    toast("Turno actualizado");
  }
};
