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
import { allowed } from "../auth/guard.js";
import { normalizeBarcode, findBarcodeProduct } from "../utils/barcodes.js";
import { bindBarcodeCamera } from "../components/barcode-camera.js";
import { closeModal } from "../components/ui.js";
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
        "Código de barras",
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
        e(p.barcode || "—"),
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
export function stockTable(products, canEdit = false) {
  return table(
    ["Producto", "Código", "Físico", "Reservado", "Disponible", "Mínimo", "Nivel", "Acciones"],
    products
      .filter((p) => p.track_stock)
      .map((p) => [
        `<b>${e(p.name)}</b>`,
        e(p.barcode || "Sin vincular"),
        p.stock_quantity,
        p.reserved,
        p.available,
        p.minimum_stock,
        `<span class="lv"><i style="width:${Math.min(100, (p.available / Math.max(1, p.minimum_stock * 2)) * 100)}%;background:${p.available <= p.minimum_stock ? "var(--bad)" : "var(--ok)"}"></i></span>${badge(p.available <= p.minimum_stock ? "Crítico" : "Normal")}`,
        canEdit ? button("Editar", "edit-product", p.id, "g sm") : "—",
      ]),
  );
}
export function stockView(s) {
  const controlled = s.products.filter((p) => p.track_stock && p.active);
  const canCreate = allowed(s.profile, "products");
  return (
    head(
      "Stock Pro",
      "Control profesional de existencias, reservas y movimientos.",
      `${canCreate ? button("+ Agregar producto", "new-product") + (s.barcodeEnabled ? button("Escanear código", "scan-stock-barcode", "", "g") : "") : ""}${button("+ Registrar movimiento", "new-move")}`,
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
    stockTable(controlled, canCreate) +
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
export function productDialog(s, refresh, id, scannedCode = "") {
  const p = s.products.find((p) => p.id === id);
  modal(
    p ? "Editar producto" : "Nuevo producto",
    `<div class="form-stack">${input("Nombre", "name", p?.name || "", "text", 'required maxlength="160"')}${input("Categoría", "category", p?.category || "General", "text", 'required maxlength="100"')}${s.barcodeEnabled ? `${input("Código de barras", "barcode", scannedCode || p?.barcode || "", "text", 'maxlength="80" autocomplete="off" placeholder="Escribí, escaneá o usá un lector USB"')}<div class="barcode-tools"><button type="button" class="btn g sm" id="scanProductBarcode">Escanear con cámara</button><small id="barcodeHint">Un código único por producto.</small><div class="barcode-preview" id="productBarcodePreview" hidden></div></div>` : ""}${input("Precio ($)", "price", p?.price ?? 0, "number", 'required min="0" step="0.01"')}${input("Tono / Hue (0–360)", "visual_hue", p?.visual_hue ?? 210, "number", 'required min="0" max="360"')}${input("Stock mínimo", "minimum_stock", p?.minimum_stock ?? 0, "number", 'required min="0" step="1"')}${p ? "" : input("Stock inicial", "stock_quantity", 0, "number", 'required min="0" step="1"')}${select(
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
      if (s.barcodeEnabled) fields.barcode = normalizeBarcode(fields.barcode);
      fields.active = data.has("active");
      fields.published = data.has("published");
      if (p) fields.id = p.id;
      else fields.track_stock = data.has("track_stock");
      await rpc(s.barcodeEnabled ? "save_product_with_barcode" : "save_product", { payload: fields });
      await refresh();
      toast(s.barcodeEnabled ? "Producto guardado con su código de barras" : "Producto guardado");
    },
    true,
  );
  if (!s.barcodeEnabled) return;
  const field = document.querySelector('#modalRoot [name="barcode"]');
  field.closest("label")?.classList.add("full");
  field.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
  const hint = document.querySelector("#barcodeHint");
  const validateBarcode = () => {
    let message = "";
    try {
      const code = normalizeBarcode(field.value);
      const other = findBarcodeProduct(s.products, s.barcodes || [], code);
      if (other && other.id !== p?.id) message = `El código ya pertenece a "${other.name}".`;
    } catch (error) { message = error.message; }
    field.setCustomValidity(message);
    hint.textContent = message || "Vinculá un código único. También admite lector USB/Bluetooth.";
  };
  field.addEventListener("input", validateBarcode);
  validateBarcode();
  bindBarcodeCamera(
    document.querySelector("#scanProductBarcode"),
    document.querySelector("#productBarcodePreview"),
    (code) => { field.value = code; validateBarcode(); if (field.validationMessage) field.reportValidity(); },
  );
}

export function scanStockBarcodeDialog(s, refresh) {
  modal(
    "Buscar o cargar por código de barras",
    `<div class="form-stack">
      <p>Escaneá el código. Si existe, abriremos el producto; si es nuevo, podrás completar el alta.</p>
      ${input("Código de barras", "stock_scan_code", "", "text", 'id="stockScanCode" maxlength="80" autocomplete="off" placeholder="Ingresá o escaneá el código"')}
      <button type="button" class="btn g" id="scanStockCamera">Usar cámara</button>
      <div class="barcode-preview" id="stockBarcodePreview" hidden></div>
      <button type="button" class="btn" id="stockScanContinue">Continuar</button>
    </div>`,
    null, true,
  );
  const field = document.querySelector("#stockScanCode");
  const proceed = () => {
    try {
      const code = normalizeBarcode(field.value);
      if (!code) throw new Error("Ingresá o escaneá un código");
      const product = findBarcodeProduct(s.products, s.barcodes || [], code);
      closeModal();
      productDialog(s, refresh, product?.id || null, product ? "" : code);
    } catch (error) { document.querySelector("#dialogError").textContent = error.message; }
  };
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); proceed(); }
  });
  document.querySelector("#stockScanContinue").onclick = proceed;
  bindBarcodeCamera(
    document.querySelector("#scanStockCamera"),
    document.querySelector("#stockBarcodePreview"),
    (code) => { field.value = code; proceed(); },
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
