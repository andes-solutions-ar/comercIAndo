import test from "node:test";
import assert from "node:assert/strict";
import {
  totals,
  change,
  validateQuantity,
  nextDelivery,
  hasAdminCapacity,
} from "../src/utils/business.js";
test("IVA incluido, centavos, total and quote total", () => {
  assert.deepEqual(totals([{ quantity: 2, unit_price: 605 }], 21), {
    total: 1210,
    subtotal: 1000,
    tax: 210,
  });
  assert.equal(
    totals(
      [
        { quantity: 3, unit_price: 0.1 },
        { quantity: 2, unit_price: 0.2 },
      ],
      0,
    ).total,
    0.7,
  );
});
test("cash change and shortage", () => {
  assert.equal(change(2000, 1210), 790);
  assert.equal(change(1000, 1210), -210);
});
test("quantity cannot exceed available or be fractional", () => {
  assert.throws(() => validateQuantity({ track_stock: true, available: 2 }, 3));
  assert.throws(() => validateQuantity({ track_stock: false }, 1.5));
  assert.equal(validateQuantity({ track_stock: false }, 10), 10);
});
test("delivery cannot advance twice after completed", () => {
  assert.equal(nextDelivery("Pendiente"), "Preparado");
  assert.equal(nextDelivery("Preparado"), "Entregado");
  assert.throws(() => nextDelivery("Entregado"));
});
test("pending invites count against the admin limit", () => {
  assert.equal(hasAdminCapacity(2, 1), false);
  assert.equal(hasAdminCapacity(2, 0), true);
});
