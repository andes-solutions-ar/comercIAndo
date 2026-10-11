export function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Importe inválido");
  return Math.round(n * 100);
}
export function totals(items, taxRate = 0) {
  const totalCents = items.reduce(
    (n, i) => n + cents(i.unit_price) * i.quantity,
    0,
  );
  const subtotalCents = Math.round(totalCents / (1 + Number(taxRate) / 100));
  return {
    total: totalCents / 100,
    subtotal: subtotalCents / 100,
    tax: (totalCents - subtotalCents) / 100,
  };
}
export function change(received, total) {
  return (cents(received) - cents(total)) / 100;
}
export function validateQuantity(product, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new Error("Cantidad inválida");
  if (product.track_stock && quantity > product.available)
    throw new Error("Stock disponible insuficiente");
  return quantity;
}
export function nextDelivery(status) {
  if (status === "Pendiente") return "Preparado";
  if (status === "Preparado") return "Entregado";
  throw new Error("Entrega completada o cancelada");
}
export const hasAdminCapacity = (active, pending) => active + pending < 3;
