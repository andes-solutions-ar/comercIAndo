import {
  head,
  button,
  badge,
  table,
  input,
  select,
  check,
  modal,
  formValues,
  productOptions,
  toast,
} from "../components/ui.js";
import { escapeHtml as e, money, date } from "../utils/format.js";
import { query, rpc } from "../services/api.js";
import { totals } from "../utils/business.js";
export function businessView(s) {
  const quotes = s.settings.business_module === "quotes";
  return (
    head("Módulo empresarial", "Un módulo empresarial incluido en Premium.") +
    `<div class="g2"><div class="card padded">${badge(quotes ? "ACTIVO" : "ALTERNATIVA")}<h3>Presupuestos y cotizaciones</h3><p class="muted">Propuestas para clientes vinculadas al catálogo.</p></div><div class="card padded">${badge(!quotes ? "ACTIVO" : "ALTERNATIVA")}<h3>Nómina de personal y turnos</h3><p class="muted">Colaboradores y distribución de horarios.</p></div></div>` +
    (quotes
      ? `<div class="ch"><h2>Presupuestos recientes</h2>${button("+ Nuevo presupuesto", "new-quote")}</div>` +
        table(
          ["Nro.", "Cliente", "Total", "Estado", "Fecha", "Acciones"],
          s.quotes.map((q) => [
            `#${q.quote_number}`,
            e(q.customer_name),
            money(q.total),
            badge(q.status),
            date(q.created_at),
            button("Detalle", "view-quote", q.id, "g sm") +
              (q.status === "Enviado"
                ? button("Aceptar", "accept-quote", q.id, "g sm")
                : ""),
          ]),
        )
      : `<div class="ch"><h2>Personal</h2>${button("+ Agregar personal", "new-staff")}</div>` +
        table(
          ["Nombre", "Rol", "Estado", "Acciones"],
          s.staff.map((p) => [
            e(p.full_name),
            e(p.role),
            badge(p.active ? "Activo" : "Inactivo"),
            button("Editar", "edit-staff", p.id, "g sm"),
          ]),
        ) +
        `<div class="ch"><h2>Turnos</h2>${button("+ Nuevo turno", "new-shift")}</div>` +
        table(
          ["Personal", "Inicio", "Fin", "Estado", "Acciones"],
          s.shifts.map((t) => [
            e(s.staff.find((p) => p.id === t.staff_id)?.full_name || "—"),
            date(t.start_at),
            date(t.end_at),
            badge(t.status),
            t.status === "Programado"
              ? button("Completar", "complete-shift", t.id, "g sm") +
                button("Cancelar", "cancel-shift", t.id, "g sm")
              : "—",
          ]),
        ))
  );
}
export function quoteDialog(s, refresh) {
  const request_id = crypto.randomUUID();
  const lines = [];
  modal(
    "Nuevo presupuesto",
    `${input("Cliente", "customer_name", "", "text", 'required maxlength="160"')}<div class="form-stack">${select("Producto / servicio", "lineProduct", [["", "Concepto libre"], ...productOptions(s.products)])}${input("Concepto libre", "lineName", "", "text", 'maxlength="160"')}${input("Precio unitario del concepto libre", "linePrice", 0, "number", 'min="0" step="0.01"')}${input("Cantidad", "lineQuantity", 1, "number", 'min="1" step="1"')}</div><button type="button" class="btn g" id="addQuoteLine">Agregar ítem</button><div id="quoteLines"></div><strong id="quoteTotal"></strong>`,
    async (data) => {
      if (!lines.length) throw new Error("Agregá al menos un ítem");
      await rpc("save_quote", {
        payload: {
          request_id,
          customer_name: data.get("customer_name"),
          items: lines,
        },
      });
      await refresh();
      toast("Presupuesto guardado");
    },
    true,
  );
  const form = document.querySelector("#dialogForm");
  form.querySelector("#addQuoteLine").onclick = () => {
    const data = new FormData(form),
      p = s.products.find((p) => p.id === data.get("lineProduct")),
      quantity = Number(data.get("lineQuantity")),
      price = p ? Number(p.price) : Number(data.get("linePrice")),
      name = p?.name || data.get("lineName").trim();
    if (!Number.isInteger(quantity) || quantity <= 0 || price < 0 || !name) {
      document.querySelector("#dialogError").textContent =
        "Completá un concepto, precio y cantidad válidos.";
      return;
    }
    lines.push({
      product_id: p?.id || null,
      product_name: name,
      quantity,
      unit_price: price,
    });
    paint();
  };
  function paint() {
    form.querySelector("#quoteLines").innerHTML = table(
      ["Concepto", "Cantidad", "Precio", "Total", ""],
      lines.map((l, i) => [
        e(l.product_name),
        l.quantity,
        money(l.unit_price),
        money(l.quantity * l.unit_price),
        `<button type="button" class="btn g sm" data-remove-line="${i}" aria-label="Quitar ítem">✕</button>`,
      ]),
    );
    form.querySelector("#quoteTotal").textContent =
      "Total: " + money(totals(lines).total);
    form.querySelectorAll("[data-remove-line]").forEach(
      (b) =>
        (b.onclick = () => {
          lines.splice(Number(b.dataset.removeLine), 1);
          paint();
        }),
    );
  }
  paint();
}
export async function viewQuote(id) {
  const [quotes, items] = await Promise.all([
    query("quotes", (q) => q.eq("id", id)),
    query("quote_items", (q) => q.eq("quote_id", id)),
  ]);
  const q = quotes[0];
  if (!q) throw new Error("Presupuesto inexistente");
  modal(
    "Presupuesto #" + q.quote_number,
    `<p>${e(q.customer_name)} · ${e(q.status)}</p>${table(
      ["Concepto", "Cantidad", "Precio", "Total"],
      items.map((i) => [
        e(i.product_name),
        i.quantity,
        money(i.unit_price),
        money(i.line_total),
      ]),
    )}<strong>Total: ${money(q.total)}</strong>`,
  );
}
export function staffDialog(s, refresh, id) {
  const p = s.staff.find((p) => p.id === id);
  modal(
    p ? "Editar personal" : "Nuevo colaborador",
    `<div class="form-stack">${input("Nombre completo", "full_name", p?.full_name || "", "text", 'required maxlength="120"')}${input("Rol", "role", p?.role || "", "text", 'required maxlength="120"')}${check("Activo", "active", p?.active ?? true)}</div>`,
    async (data) => {
      await rpc("save_staff", {
        payload: { ...formValues(data), id: p?.id, active: data.has("active") },
      });
      await refresh();
    },
  );
}
export function shiftDialog(s, refresh) {
  modal(
    "Nuevo turno",
    `<div class="form-stack">${select(
      "Colaborador",
      "staff_id",
      s.staff.filter((p) => p.active).map((p) => [p.id, p.full_name]),
    )}${input("Inicio", "start_at", "", "datetime-local", "required")}${input("Fin", "end_at", "", "datetime-local", "required")}</div>`,
    async (data) => {
      const fields = formValues(data);
      fields.start_at = new Date(fields.start_at).toISOString();
      fields.end_at = new Date(fields.end_at).toISOString();
      await rpc("save_shift", { payload: fields });
      await refresh();
    },
  );
}
