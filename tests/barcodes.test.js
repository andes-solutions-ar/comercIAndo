import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBarcode, findBarcodeProduct } from "../src/utils/barcodes.js";

test("códigos EAN/UPC conservan ceros iniciales", () => {
  assert.equal(normalizeBarcode(" 0001234567890 "), "0001234567890");
});
test("rechaza códigos vacíos mal formados, pero permite uno sin vincular", () => {
  assert.equal(normalizeBarcode(" "), "");
  for (const invalid of ["123", "12 345", "x\n234", "a".repeat(81)]) {
    assert.throws(() => normalizeBarcode(invalid));
  }
});
test("distingue productos por código exacto", () => {
  const products = [{ id: "a", name: "Agua" }, { id: "b", name: "Gaseosa" }];
  const barcodes = [{ product_id: "b", code: "0001234567890" }];
  assert.deepEqual(findBarcodeProduct(products, barcodes, "0001234567890"), products[1]);
  assert.equal(findBarcodeProduct(products, barcodes, "9999999999999"), null);
});
