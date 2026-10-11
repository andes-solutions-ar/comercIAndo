import {
  head,
  button,
  badge,
  table,
  kpis,
  tile,
  input,
  select,
  check,
  modal,
  formValues,
  toast,
} from "../components/ui.js";
import {
  escapeHtml as e,
  money,
  date,
  today,
  day,
  sum,
} from "../utils/format.js";
import { rpc } from "../services/api.js";
export function productsView(s) {
  return (
    head(
      "Productos y servicios",
      "Catálogo central utilizado por tienda, POS y Stock Pro.",
      button("+ Nuevo producto", "new-product"),
    ) +
    `<div class="bar"><input class="search" data-filter placeholder="Buscar producto…" aria-label="Buscar producto"></div>` +
    table(
      [
        "Producto",
        "Categoría",
        "Precio",
        "Físico",
        "Reservado",
        "Disponible",
        "Estado",
        "Acciones",
      ],
      s.products.map((p) => [
        `<div class="product-name">${tile(p, true)}<b>${e(p.name)}</b></div>`,
        e(p.category),
        money(p.price),
        p.track_stock ? p.stock_quantity : "—",
        p.track_stock ? p.reserved : "—",
        p.track_stock ? p.available : "Servicio",
        badge(p.active ? "Activo" : "Inactivo") +
          " " +
          badge(p.published ? "Publicado" : "Privado"),
        button("Editar", "edit-product", p.id, "g sm"),
      ]),
    )
  );
}
export function stockTable(products) {
  return table(
    ["Producto", "Físico", "Reservado", "Disponible", "Mínimo", "Nivel"],
    products
      .filter((p) => p.track_stock)
      .map((p) => [
        `<b>${e(p.name)}</b>`,
        p.stock_quantity,
        p.reserved,
        p.available,
        p.minimum_stock,
        `<span class="lv"><i style="width:${Math.min(100, (p.available / Math.max(1, p.minimum_stock * 2)) * 100)}%;background:${p.available <= p.minimum_stock ? "var(--bad)" : "var(--ok)"}"></i></span>${badge(p.available <= p.minimum_stock ? "Crítico" : "Normal")}`,
      ]),
  );
}
export function stockView(s) {
  const controlled = s.products.filter((p) => p.track_stock && p.active);
  return (
    head(
      "Stock Pro",
      "Control profesional de existencias, reservas y movimientos.",
      button("+ Registrar movimiento", "new-move"),
    ) +
    kpis([
      ["Productos controlados", controlled.length],
      [
        "Stock crítico",
        controlled.filter((p) => p.available <= p.minimum_stock).length,
      ],
      ["Reservado", sum(controlled, "reserved"), "Unidades comprometidas"],
      [
        "Movimientos hoy",
        s.movements.filter((m) => day(m.created_at) === today()).length,
      ],
    ]) +
    stockTable(controlled) +
    `<div class="ch"><h2>Últimos movimientos</h2></div>` +
    table(
      [
        "Fecha",
        "Producto",
        "Movimiento",
        "Cantidad",
        "Referencia",
        "Responsable",
      ],
      s.movements.map((m) => [
        date(m.created_at),
        e(s.products.find((p) => p.id === m.product_id)?.name || "Producto"),
        badge(m.type),
        m.quantity,
        e(m.reference),
        e(
          s.profiles.find((p) => p.id === m.responsible)?.full_name ||
            m.responsible?.slice(0, 8) ||
            "Sistema",
        ),
      ]),
    )
  );
}
export function productDialog(s, refresh, id) {
  const p = s.products.find((p) => p.id === id);
  modal(
    p ? "Editar producto" : "Nuevo producto",
    `<div class="form-stack">${input("Nombre", "name", p?.name || "", "text", 'required maxlength="160"')}${input("Categoría", "category", p?.category || "General", "text", 'required maxlength="100"')}${input("Precio ($)", "price", p?.price ?? 0, "number", 'required min="0" step="0.01"')}${input("Tono / Hue (0–360)", "visual_hue", p?.visual_hue ?? 210, "number", 'required min="0" max="360"')}${input("Stock mínimo", "minimum_stock", p?.minimum_stock ?? 0, "number", 'required min="0" step="1"')}${p ? "" : input("Stock inicial", "stock_quantity", 0, "number", 'required min="0" step="1"')}${select(
      "Tipo",
      "item_type",
      [
        ["product", "Producto"],
        ["service", "Servicio"],
      ],
      p?.item_type || "product",
    )}${p ? "" : check("Controlar stock", "track_stock", true)}${check("Activo", "active", p?.active ?? true)}${check("Publicado en catálogo", "published", p?.published ?? false)}</div>${p ? "<p>Las existencias se modifican desde Stock Pro para conservar su trazabilidad.</p>" : ""}`,
    async (data) => {
      const fields = formValues(data);
      fields.active = data.has("active");
      fields.published = data.has("published");
      if (p) fields.id = p.id;
      else fields.track_stock = data.has("track_stock");
      await rpc("save_product", { payload: fields });
      await refresh();
      toast("Producto guardado");
    },
  );
}
export function moveDialog(s, refresh) {
  const request_id = crypto.randomUUID();
  modal(
    "Registrar movimiento",
    `<div class="form-stack">${select(
      "Producto",
      "product_id",
      s.products
        .filter((p) => p.track_stock && p.active)
        .map((p) => [p.id, p.name]),
    )}${select("Tipo de movimiento", "type", ["Entrada", "Salida"], "Entrada")}${input("Cantidad", "quantity", 1, "number", 'required min="1" step="1"')}${input("Referencia o motivo", "reference", "", "text", 'required maxlength="240"')}</div>`,
    async (data) => {
      await rpc("move_stock", { payload: { ...formValues(data), request_id } });
      await refresh();
      toast("Movimiento registrado en Kardex");
    },
  );
}
