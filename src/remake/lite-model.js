// Projection of the accepted Lite UI onto the existing, server-validated document.
// Unknown fields and historical rows are retained so changing UI cannot erase data.
const clone = (value) => structuredClone(value);
const round = (value) => Math.round(Number(value) * 100) / 100;
export function liteState(document, users = []) {
  const products = document.products.map((p, index) => ({
    id: index + 1,
    backendId: p[10].id,
    name: p[0],
    cat: p[1],
    cost: Number(p[9] || 0),
    price: p[2],
    stock: p[3],
    min: p[4],
    emoji: p[7],
    barcode: p[10].barcode || "",
    published: p[10].litePublished ?? p[10].onlinePublished ?? false,
    reserved: Number(p[10].onlineUnits || 0) + Number(p[10].webReserved || 0),
    enabled: p[10].status === "enabled",
  }));
  const productId = (id) => products.find((p) => p.backendId === id)?.id;
  const sales = document.sales
    .filter((s) => s[5] === "Cobrada")
    .map((s) => ({
      id: s[0],
      at: s[9]?.at || s[8]?.createdAt || s[8]?.at || null,
      total: s[3],
      discount: s[9]?.discountAmount || 0,
      payment: s[4],
      delivery: s[9]?.delivery || "Retiro",
      customer: s[1],
      items: (s[7] || []).map((i) => ({ ...i, id: productId(i.productId) })),
    }));
  const deliveries = [...document.orderFlow, ...document.archivedOrders]
    .filter(
      (d) =>
        !["Cancelado", "Anulado"].includes(d.status) && d.stage !== "cancelled",
    )
    .map((d) => ({
      id: d.id,
      sale: d.sale || d.id,
      customer: d.customer,
      type:
        d.deliveryType ||
        (d.address && d.address !== "Retira en local" ? "Envío" : "Retiro"),
      address: d.address === "Retira en local" ? "" : d.address || "",
      status:
        d.status === "Entregado"
          ? "Entregado"
          : d.dispatchStage === "preparing" || d.dispatchStage === "ready"
            ? "En preparación"
            : "Pendiente",
      paid: !!d.paymentConfirmed,
      web: !!d.backendOrderId,
    }));
  return {
    products,
    categories: clone(document.categories),
    sales,
    deliveries,
    movements: document.movements.map((m) => ({
      at: m[6]?.at,
      name: m[1],
      delta:
        m[0] === "Salida" ? -Number(m[6]?.qty || 0) : Number(m[6]?.qty || 0),
      reason: m[3],
      persisted: true,
    })),
    cash: document.cashSessions.some((c) => c.status === "open"),
    sound: document.settings.sound !== false,
    theme: document.settings.liteTheme || "dark",
    store: document.settings.storeName || "Mi emprendimiento",
    users: users.map((u) => u[0]),
  };
}
export function liteDocument(
  state,
  previous,
  profile,
  uuid = () => crypto.randomUUID(),
) {
  const next = clone(previous),
    at = new Date().toISOString();
  const actor = profile.full_name;
  next.categories = clone(state.categories);
  Object.assign(next.settings, {
    storeName: state.store,
    sound: state.sound,
    liteTheme: state.theme,
  });
  const ids = new Set(),
    names = new Set(),
    barcodes = new Set();
  next.products = state.products.map((p) => {
    if (!p.name.trim() || names.has(p.name.trim().toLocaleLowerCase("es")))
      throw Error(
        "El nombre del producto debe ser único y no puede estar vacío.",
      );
    names.add(p.name.trim().toLocaleLowerCase("es"));
    if (p.barcode && barcodes.has(p.barcode))
      throw Error("Código de barras repetido.");
    if (p.barcode) barcodes.add(p.barcode);
    if (
      ![p.cost, p.price, p.stock, p.min].every(Number.isFinite) ||
      p.cost < 0 ||
      p.price < 0 ||
      !Number.isInteger(p.stock) ||
      p.stock < 0 ||
      !Number.isInteger(p.min) ||
      p.min < 0
    )
      throw Error(
        "Revisá precios y cantidades: deben ser valores válidos y no negativos.",
      );
    const old = previous.products.find((x) => x[10].id === p.backendId);
    const row = old
      ? clone(old)
      : [
          p.name,
          p.cat,
          0,
          0,
          0,
          0,
          [],
          p.emoji || "📦",
          "#eef2ff",
          0,
          {
            id: uuid(),
            policy: "unlimited",
            status: "enabled",
            onlineUnits: 0,
            webReserved: 0,
            onlinePublished: false,
          },
        ];
    if (ids.has(row[10].id)) throw Error("Identificador de producto repetido.");
    ids.add(row[10].id);
    p.backendId = row[10].id;
    row[0] = p.name.trim();
    row[1] = p.cat;
    row[2] = round(p.price);
    row[3] = p.stock;
    row[4] = p.min;
    row[9] = round(p.cost);
    Object.assign(row[10], {
      barcode: p.barcode,
      litePublished: p.published,
      initialCost: round(p.cost),
    });
    return row;
  });
  // Build only new sales. Historical server rows are never rewritten by the UI.
  for (const sale of [...state.sales].reverse()) {
    if (previous.sales.some((s) => s[0] === sale.id)) continue;
    if (!state.cash || !previous.cashSessions.some((c) => c.status === "open"))
      throw Error("Abrí caja antes de cobrar.");
    if (!sale.items.length) throw Error("La venta no tiene productos.");
    const items = sale.items.map((i) => {
      const p = state.products.find((p) => p.id === i.id);
      const old = previous.products.find((p0) => p0[10].id === p?.backendId);
      if (!old || !Number.isInteger(i.qty) || i.qty <= 0 || i.price !== old[2])
        throw Error("Producto, cantidad o precio inválido.");
      return {
        productId: p.backendId,
        name: old[0],
        qty: i.qty,
        price: old[2],
      };
    });
    const subtotal = round(items.reduce((n, i) => n + i.qty * i.price, 0));
    const discount = round(sale.discount || 0);
    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > subtotal ||
      round(sale.total) !== round(subtotal - discount)
    )
      throw Error("El total no coincide con los productos y el descuento.");
    next.sales.unshift([
      sale.id,
      sale.customer,
      "Mostrador",
      round(sale.total),
      sale.payment,
      "Cobrada",
      new Date(sale.at).toLocaleTimeString("es-AR"),
      items,
      {},
      { discountAmount: discount, at: sale.at, delivery: sale.delivery },
    ]);
    next.payments.unshift([
      uuid(),
      sale.id.replace(/\D/g, ""),
      sale.payment,
      round(sale.total),
      "Aprobado",
      { at: sale.at, actor: profile.id },
    ]);
    const session = previous.cashSessions.find((c) => c.status === "open");
    next.cashMoves.push({
      id: uuid(),
      sessionId: session.id,
      type: "sale",
      amount: round(sale.total),
      method: sale.payment,
      saleId: sale.id,
      at: sale.at,
      user: actor,
    });
  }
  for (const m of state.movements.filter((m) => !m.persisted)) {
    next.movements.unshift([
      m.delta < 0 ? "Salida" : "Entrada",
      m.name,
      (m.delta > 0 ? "+" : "") + m.delta,
      m.reason,
      actor,
      new Date(m.at).toLocaleTimeString("es-AR"),
      {
        id: uuid(),
        at: m.at,
        qty: Math.abs(m.delta),
        source: "lite",
        actor: profile.id,
      },
    ]);
  }
  const open = next.cashSessions.find((c) => c.status === "open");
  if (state.cash && !open)
    next.cashSessions.push({
      id: uuid(),
      branch: next.settings.branch,
      status: "open",
      opening: 0,
      openedAt: at,
      user: actor,
    });
  if (!state.cash && open)
    Object.assign(open, { status: "closed", closedAt: at, closedBy: actor });
  for (const d of state.deliveries) {
    let flow = [...next.orderFlow, ...next.archivedOrders].find(
      (f) => f.id === d.id,
    );
    const original = liteState(previous).deliveries.find(
      (item) => item.id === d.id,
    );
    if (flow && JSON.stringify(original) === JSON.stringify(d)) continue;
    if (!flow) {
      const sale = state.sales.find((s) => s.id === d.sale);
      flow = {
        id: d.id,
        sale: d.sale,
        customer: d.customer,
        channel: "Mostrador",
        items: [],
        total: sale?.total || 0,
        payment: sale?.payment || "Pendiente",
        paymentConfirmed: !!sale,
        createdAt: at,
        branch: next.settings.branch,
        stockApplied: !!sale,
      };
      next.orderFlow.unshift(flow);
    }
    if (
      d.status === "Entregado" &&
      flow.backendOrderId &&
      !flow.paymentConfirmed
    )
      throw Error("El pedido web debe estar cobrado antes de entregarlo.");
    Object.assign(flow, {
      address: d.address || "Retira en local",
      deliveryType: d.type,
      status: d.status,
      stage: d.status === "Entregado" ? "delivered" : "received",
      dispatchStage:
        d.status === "Entregado"
          ? "delivered"
          : d.status === "En preparación"
            ? "preparing"
            : "waiting",
    });
    if (d.status === "Entregado") flow.deliveredAt ||= at;
  }
  next.audit.unshift({
    id: uuid(),
    at,
    actor: profile.id,
    action: "Actualización Emprendedores",
  });
  return next;
}
