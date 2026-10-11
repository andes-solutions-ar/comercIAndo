import {
  head,
  button,
  badge,
  table,
  kpis,
  input,
  select,
  check,
  modal,
  formValues,
  toast,
} from "../components/ui.js";
import { escapeHtml as e, date } from "../utils/format.js";
import { updateSettings, rpc, edge } from "../services/api.js";
export const permissionLabels = {
  dashboard: "Inicio",
  pos: "Punto de venta",
  sales: "Ventas y pedidos",
  payments: "Pagos",
  catalog: "Tienda / catálogo",
  products: "Productos y servicios",
  stock: "Stock Pro",
  deliveries: "Entrega segura",
  users: "Usuarios",
  module: "Módulo empresarial",
  settings: "Configuración",
};
export function settingsView(s) {
  const c = s.settings;
  return (
    head(
      "Configuración",
      "Preferencias generales de la plataforma y del negocio.",
      button("Guardar cambios", "save-settings"),
    ) +
    `<form id="settingsForm"><div class="g2"><div class="card padded"><h2>Identidad del negocio</h2><div class="form-stack">${input("Nombre comercial", "store_name", c.store_name, "text", 'required maxlength="120"')}${input("Rubro", "business_category", c.business_category, "text", "required")}${input("CUIT (opcional)", "tax_id", c.tax_id || "")}${input("Condición fiscal (opcional)", "tax_condition", c.tax_condition || "")}${input("IVA incluido (%)", "tax_rate", c.tax_rate, "number", 'min="0" max="100" step="0.01" required')}${select(
      "Módulo empresarial",
      "business_module",
      [
        ["quotes", "Presupuestos y cotizaciones"],
        ["staff_shifts", "Nómina de personal y turnos"],
      ],
      c.business_module,
    )}</div></div><div class="card padded"><h2>Preferencias del sistema</h2><div class="settings-switches">${check("Sonidos de caja", "sound_enabled", c.sound_enabled)}${check("Descuento de stock en vivo", "live_stock_discount", true, true)}<p class="muted">Stock Pro registra siempre el descuento al cobrar en POS.</p>${check("Impresión automática", "auto_print", c.auto_print)}${check("Catálogo público", "public_catalog_enabled", c.public_catalog_enabled)}${check("Recibir pedidos web", "web_orders_enabled", c.web_orders_enabled)}${check("Mostrar disponibilidad", "show_availability", c.show_availability)}${check("Pagos online QR", "online_payments_enabled", false, true)}<p class="muted">Pasarela no configurada.</p></div></div></div></form>`
  );
}
export async function saveSettings(s, refresh) {
  const form = document.querySelector("#settingsForm");
  if (!form.reportValidity()) return;
  const fields = new FormData(form),
    payload = formValues(fields);
  for (const key of [
    "sound_enabled",
    "auto_print",
    "public_catalog_enabled",
    "web_orders_enabled",
    "show_availability",
  ])
    payload[key] = fields.has(key);
  payload.live_stock_discount = true;
  payload.online_payments_enabled = false;
  payload.tax_id = payload.tax_id.trim() || null;
  payload.tax_condition = payload.tax_condition.trim() || null;
  if (payload.web_orders_enabled && !payload.public_catalog_enabled)
    throw new Error("Activá el catálogo público para recibir pedidos.");
  await updateSettings(payload);
  await refresh();
  toast("Configuración guardada");
}
export function usersView(s) {
  const admins = s.profiles.filter(
      (p) => p.access_level === "admin" && p.active,
    ),
    pending = s.invitations.filter((i) => i.status === "pending");
  return (
    head(
      "Usuarios",
      "Accesos administrativos y permisos del negocio.",
      s.profile.access_level === "super_admin"
        ? button("+ Invitar usuario", "invite-user")
        : "",
    ) +
    kpis([
      ["Administradores activos", admins.length, "Máximo 3"],
      ["Invitaciones pendientes", pending.length],
      [
        "Acceso Andes",
        s.profiles.filter((p) => p.access_level === "super_admin" && p.active)
          .length,
        "No ocupa cupo",
      ],
    ]) +
    table(
      ["Nombre", "Rol", "Nivel", "Estado", "Permisos", "Acción"],
      s.profiles.map((p) => [
        e(p.full_name),
        e(p.display_role),
        e(p.access_level),
        badge(p.active ? "Activo" : "Inactivo"),
        p.access_level === "super_admin"
          ? "Acceso completo"
          : e(
              Object.entries(p.permissions)
                .filter(([, v]) => v === true)
                .map(([k]) => permissionLabels[k] || k)
                .join(", "),
            ),
        p.access_level === "admin" && s.profile.access_level === "super_admin"
          ? button("Editar acceso", "edit-admin", p.id, "g sm")
          : "Protegido",
      ]),
    ) +
    (pending.length
      ? `<div class="ch"><h2>Invitaciones pendientes</h2></div>` +
        table(
          ["Email", "Fecha"],
          pending.map((i) => [e(i.email), date(i.created_at)]),
        )
      : "")
  );
}
export function userDialog(s, refresh, id) {
  const p = s.profiles.find((p) => p.id === id);
  modal(
    p ? "Editar acceso" : "Invitar administrador",
    `<div class="form-stack">${input("Nombre completo", "full_name", p?.full_name || "", "text", 'required maxlength="120"')}${p ? "" : input("Email", "email", "", "email", "required")}${input("Rol visible", "display_role", p?.display_role || "Administrador", "text", 'required maxlength="120"')}${p ? check("Acceso activo", "active", p.active) : ""}</div><h3>Permisos</h3><div class="permissions-grid">${Object.entries(
      permissionLabels,
    )
      .map(([key, label]) =>
        check(
          label,
          "perm_" + key,
          p
            ? p.permissions[key] === true
            : [
                "dashboard",
                "pos",
                "sales",
                "products",
                "stock",
                "deliveries",
              ].includes(key),
        ),
      )
      .join("")}</div>`,
    async (data) => {
      const fields = formValues(data);
      fields.permissions = Object.fromEntries(
        Object.keys(permissionLabels).map((key) => [
          key,
          data.has("perm_" + key),
        ]),
      );
      Object.keys(fields)
        .filter((k) => k.startsWith("perm_"))
        .forEach((k) => delete fields[k]);
      if (p) {
        fields.id = p.id;
        fields.active = data.has("active");
        await rpc("update_admin", { payload: fields });
      } else await edge("admin-invite-user", fields);
      await refresh();
      toast(p ? "Acceso actualizado" : "Invitación enviada");
    },
    true,
  );
}
