import { head, button, kpis, empty } from "../components/ui.js";
import { stockTable } from "./inventory.js";
import { ic } from "../components/navigation.js";
import { allowed } from "../auth/guard.js";
import {
  escapeHtml as e,
  money,
  date,
  sum,
  day,
  today,
} from "../utils/format.js";
export function dashboardView(s) {
  const paid = s.sales.filter(
      (x) => x.status === "Cobrada" && day(x.created_at) === today(),
    ),
    yesterday = day(new Date(Date.now() - 86400000));
  const prior = sum(
      s.sales.filter(
        (x) => x.status === "Cobrada" && day(x.created_at) === yesterday,
      ),
      "total",
    ),
    total = sum(paid, "total");
  const variation = prior
    ? (((total - prior) / prior) * 100).toLocaleString("es-AR", {
        maximumFractionDigits: 1,
      }) + "% vs. ayer"
    : total
      ? "Sin base de comparación ayer"
      : "Sin ventas hoy ni ayer";
  const critical = s.products.filter(
    (p) => p.active && p.track_stock && p.available <= p.minimum_stock,
  );
  const hours = Array.from({ length: 24 }, (_, hour) => [
    hour,
    sum(
      paid.filter(
        (x) =>
          Number(
            new Intl.DateTimeFormat("en-GB", {
              timeZone: "America/Argentina/Buenos_Aires",
              hour: "2-digit",
              hourCycle: "h23",
            }).format(new Date(x.created_at)),
          ) === hour,
      ),
      "total",
    ),
  ]);
  const max = Math.max(1, ...hours.map((h) => h[1]));
  const chart = `<svg viewBox="0 0 640 230" role="img" aria-label="Ventas por hora de hoy">${[0, 0.5, 1].map((r) => `<line x1="48" x2="630" y1="${204 - r * 180}" y2="${204 - r * 180}" stroke="var(--line)"/><text x="1" y="${208 - r * 180}" fill="var(--mute)" font-size="9">${money(max * r)}</text>`).join("")}${hours.map(([h, v], i) => `<g><title>${h}:00 — ${money(v)}</title><rect x="${50 + i * 24}" y="${204 - (v / max) * 180}" width="17" height="${(v / max) * 180}" rx="4" fill="${v === max ? "var(--ac)" : "var(--acs)"}"/>${i % 2 === 0 ? `<text x="${59 + i * 24}" y="223" font-size="10" text-anchor="middle" fill="var(--mute)">${h}</text>` : ""}</g>`).join("")}</svg>`;
  const events = [
    ...s.sales.map((x) => ({
      text: `Venta #${x.sale_number} · ${x.status}`,
      at: x.created_at,
    })),
    ...s.movements.map((x) => ({
      text: `Stock · ${x.type} ${x.quantity} u.`,
      at: x.created_at,
    })),
    ...s.payments.map((x) => ({
      text: `Pago ${x.method} · ${x.status}`,
      at: x.updated_at,
    })),
    ...s.deliveries.map((x) => ({
      text: `Entrega · ${x.status}`,
      at: x.updated_at,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  const shortcuts = [
    ["pos", "Nueva venta", "Abrir punto de venta", "pos"],
    ["prod", "Nuevo producto", "Gestionar catálogo", "products"],
    ["stock", "Movimiento de stock", "Registrar entrada o salida", "stock"],
    ["ship", "Entregas", "Ver pendientes", "deliveries"],
  ].filter((x) => allowed(s.profile, x[3]));
  return (
    head(
      "Resumen del negocio",
      "Tu operación comercial en una sola vista.",
      allowed(s.profile, "pos") ? button("+ Nueva venta", "go-pos") : "",
    ) +
    kpis([
      ["Ventas de hoy", money(total), variation],
      [
        "Operaciones",
        paid.length,
        "Ticket prom. " + money(paid.length ? total / paid.length : 0),
      ],
      ["Stock crítico", critical.length, "Requieren atención"],
      [
        "Entregas",
        s.deliveries.filter((x) =>
          ["Pendiente", "Preparado"].includes(x.status),
        ).length,
        "Pendientes de completar",
      ],
    ]) +
    `<div class="g2"><div class="card"><div class="ch"><div><h2>Ventas por hora</h2><p>Actividad registrada durante la jornada.</p></div><span class="pill m">HOY</span></div><div id="chart">${chart}</div></div><div class="card"><div class="ch"><div><h2>Atajos</h2><p>Acciones frecuentes.</p></div></div><div class="sc">${shortcuts.map(([key, label, sub]) => `<button data-go="${key}"><span class="ic">${ic(key)}</span><span><b>${label}</b><small>${sub}</small></span></button>`).join("")}</div></div></div><div class="g2"><div><div class="ch"><h2>Stock que requiere atención</h2></div>${stockTable(critical.slice(0, 5))}</div><div class="card"><div class="ch"><div><h2>Actividad reciente</h2><p>Últimos movimientos del sistema.</p></div></div><div class="act">${events.map((x) => `<div><i class="dot"></i><span>${e(x.text)}</span><time>${date(x.at)}</time></div>`).join("") || empty("Todavía no hay actividad.")}</div></div></div>`
  );
}
