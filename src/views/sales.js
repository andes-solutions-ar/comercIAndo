import { head, button, badge, table, kpis, modal } from "../components/ui.js";
import { query, rpc } from "../services/api.js";
import {
  escapeHtml as e,
  money,
  date,
  sum,
  day,
  today,
} from "../utils/format.js";
import { allowed } from "../auth/guard.js";
export function salesView(s) {
  const paid = s.sales.filter(
    (x) => x.status === "Cobrada" && day(x.created_at) === today(),
  );
  return (
    head(
      "Ventas y pedidos",
      "Operaciones generadas desde POS y canal digital.",
      allowed(s.profile, "pos") ? button("+ Nueva venta", "go-pos") : "",
    ) +
    kpis([
      ["Cobradas hoy", money(sum(paid, "total")), paid.length + " operaciones"],
      [
        "Pedidos activos",
        s.sales.filter(
          (d) =>
            d.channel === "WEB" && ["Pedido", "Pendiente"].includes(d.status),
        ).length,
      ],
      [
        "Ticket promedio",
        money(paid.length ? sum(paid, "total") / paid.length : 0),
      ],
      [
        "Pendientes de cobro",
        s.sales.filter((x) => ["Pendiente", "Pedido"].includes(x.status))
          .length,
      ],
    ]) +
    `<div class="bar"><input class="search" data-filter aria-label="Buscar operación" placeholder="Buscar operación…"><select id="salesStatus" aria-label="Estado de venta"><option value="">Todos los estados</option>${["Cobrada", "Pedido", "Pendiente", "Cancelada"].map((x) => `<option>${x}</option>`).join("")}</select></div>` +
    table(
      [
        "Operación",
        "Cliente",
        "Canal",
        "Total",
        "Pago",
        "Estado",
        "Fecha",
        "Acción",
      ],
      s.sales.map((x) => [
        `<b>#${x.sale_number}</b>`,
        e(x.customer_name),
        badge(x.channel),
        money(x.total),
        e(x.payment_method),
        badge(x.status),
        date(x.created_at),
        button("Ticket", "ticket", x.id, "g sm"),
      ]),
    )
  );
}
export function paymentsView(s) {
  const approved = s.payments.filter(
    (p) => p.status === "Aprobado" && day(p.created_at) === today(),
  );
  return (
    head(
      "Pagos",
      "Estado de cobros vinculados a cada operación.",
      badge("Pasarela no configurada"),
    ) +
    kpis([
      ["Cobrado hoy", money(sum(approved, "amount"))],
      [
        "Pagos digitales",
        s.payments.filter((p) => p.method === "Digital").length,
        "Registro manual",
      ],
      ["Pendientes", s.payments.filter((p) => p.status === "Pendiente").length],
    ]) +
    table(
      [
        "Referencia",
        "Operación",
        "Medio",
        "Monto",
        "Estado",
        "Fecha",
        "Acción",
      ],
      s.payments.map((p) => [
        e(p.id.slice(0, 8)),
        `#${s.sales.find((x) => x.id === p.sale_id)?.sale_number || "—"}`,
        e(p.method),
        money(p.amount),
        badge(p.status),
        date(p.created_at),
        p.status === "Pendiente"
          ? button("Confirmar cobro manual", "confirm-payment", p.id, "g sm")
          : "—",
      ]),
    )
  );
}
export async function showTicket(id, auto = false) {
  const [sales, items] = await Promise.all([
    query("sales", (q) => q.eq("id", id)),
    query("sale_items", (q) => q.eq("sale_id", id)),
  ]);
  const sale = sales[0];
  if (!sale) throw new Error("La venta no está disponible");
  const cfg = sale.settings_snapshot;
  modal(
    "Ticket de venta",
    `<div class="ticket-paper" id="ticketPaper"><div class="ticket-head"><h4>${e(cfg.store_name)}</h4>${cfg.tax_id ? `<div>CUIT ${e(cfg.tax_id)}</div>` : ""}${cfg.tax_condition ? `<div>${e(cfg.tax_condition)}</div>` : ""}<b>COMPROBANTE #${sale.sale_number}</b><div>${date(sale.created_at)}</div></div><div class="ticket-row"><b>DETALLE</b><b>TOTAL</b></div>${items.map((i) => `<div class="ticket-row"><span>${i.quantity} × ${e(i.product_name)}<br><small>${money(i.unit_price)} c/u</small></span><span>${money(i.line_total)}</span></div>`).join("")}<div class="ticket-div"></div><div class="ticket-row"><span>SUBTOTAL NETO:</span><span>${money(sale.subtotal)}</span></div><div class="ticket-row"><span>IVA INCLUIDO (${e(cfg.tax_rate)}%):</span><span>${money(sale.tax_amount)}</span></div><div class="ticket-row ticket-total"><b>TOTAL:</b><b>${money(sale.total)}</b></div><div class="ticket-div"></div><div>PAGO: ${e(sale.payment_method)} · ${e(sale.status)}</div><div>CLIENTE: ${e(sale.customer_name)}</div><div class="ticket-footer">Comprobante interno. No válido como factura fiscal.<br>GRACIAS POR SU COMPRA<br>comercIAndo by Andes Solutions</div></div><div class="ticket-actions">${button("Imprimir Ticket", "print-ticket")}</div>`,
  );
  document.querySelector("[data-action=print-ticket]").onclick = () =>
    window.print();
  if (auto) setTimeout(() => window.print(), 100);
}
export function confirmPaymentDialog(id, refresh) {
  modal(
    "Confirmar cobro manual",
    "<p>Confirmá que recibiste el dinero por un medio externo. Esta acción registra el cobro y no procesa una pasarela de pagos.</p>",
    async () => {
      await rpc("confirm_payment", { payment: id });
      await refresh();
    },
  );
}
export function deliveriesView(s) {
  return (
    head(
      "Entrega segura",
      "Mercadería comprometida hasta completar su entrega.",
      badge("STOCK PRO"),
    ) +
    `<div class="ship-grid">${
      s.deliveries
        .map((d) => {
          const sale = s.sales.find((x) => x.id === d.sale_id);
          return `<div class="card ship-card">${badge(d.status)}<h3>Pedido #${sale?.sale_number || "—"}</h3><p>${e(sale?.customer_name || "")}</p><strong class="num">${money(sale?.total)}</strong><small>${date(d.created_at)}</small>${button("Ver detalle", "ticket", d.sale_id, "g sm")}<div class="ship-actions">${d.status === "Pendiente" ? button("Marcar preparado", "advance-delivery", d.id) : d.status === "Preparado" ? button("Confirmar entrega", "advance-delivery", d.id) : ""}${["Pendiente", "Preparado"].includes(d.status) ? button("Cancelar pedido", "cancel-order", d.sale_id, "g sm") : ""}</div></div>`;
        })
        .join("") ||
      '<div class="card empty">No hay pedidos para entregar.</div>'
    }</div>`
  );
}
