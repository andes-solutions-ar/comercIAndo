// Conservar los ceros a la izquierda: EAN/UPC son identificadores, no números.
export function normalizeBarcode(value) {
  const code = String(value ?? "").trim();
  if (!code) return "";
  if (code.length < 4 || code.length > 80 || !/^[\x21-\x7e]+$/.test(code))
    throw new Error("El código debe tener 4 a 80 caracteres sin espacios");
  return code;
}

export function findBarcodeProduct(products, barcodes, code) {
  const key = normalizeBarcode(code);
  if (!key) return null;
  const entry = barcodes.find((b) => b.code === key);
  return products.find((p) => p.id === entry?.product_id) || null;
}
