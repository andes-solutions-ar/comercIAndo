import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseAst } from "rollup/parseAst";
const dir = new URL("../src/remake/", import.meta.url);
mkdirSync(new URL("generated/", dir), { recursive: true });
function split(name) {
  const html = readFileSync(new URL(name + "-original.html", dir), "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  return {
    html: html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""),
    engine: scripts
      .filter((m) => !/\bsrc=/.test(m[1]))
      .map((m) => m[2])
      .join("\n"),
    assets: scripts
      .filter((m) => /\bsrc=/.test(m[1]))
      .map((m) => m[1].match(/src=["']([^"']+)/)[1]),
  };
}
function replaceFunction(code, name, body) {
  const ast = parseAst(code);
  const node = ast.body.find(
    (n) => n.type === "FunctionDeclaration" && n.id?.name === name,
  );
  if (!node) throw Error("Missing " + name);
  return (
    code.slice(0, node.body.start) +
    "{" +
    body +
    "}" +
    code.slice(node.body.end)
  );
}
await import("./build-emprendedores.mjs");
let store = split("store");
store.html = store.html
  .replace("Prototipo ilustrativo.", "")
  .replace(
    "*Sin integración de pagos ni backend de producción.",
    "Los pedidos se registran en el servidor del comercio.",
  );
store.html = store.html
  .replace(
    "✦ EXPERIENCIA DE DEMOSTRACIÓN · No procesa pagos ni pedidos reales",
    "Tienda online · Pedidos sujetos a confirmación del comercio",
  )
  .replace("Abrir panel demo ↗", "Administración ↗")
  .replace(
    "Una demostración multirubro de cómo puede verse una tienda online integrada con comercIAndo Negocios. Los nombres, importes y productos son ficticios.",
    "Tienda online integrada con comercIAndo Negocios.",
  )
  .replace("Configurar demo", "Administración")
  .replace("Sin pagos ni envíos reales.", "Los pagos se confirman manualmente.")
  .replace(
    "Diseño Signature + Executive Navy · Prototipo ilustrativo. *Sin integración de pagos ni backend de producción.",
    "ComercIAndo · Andes Solutions.",
  )
  .replace("Compra de demostración", "Pedido en el comercio");
store.engine = store.engine.replace(
  "const demoAPI={",
  "const unusedLocalDemoAPI={",
);
store.engine = replaceFunction(
  store.engine,
  "token",
  "return crypto.randomUUID();",
);
store.engine = store.engine
  .replace(
    'inputmode="numeric" maxlength="6" placeholder="6 dígitos"',
    'inputmode="text" maxlength="36" placeholder="Código recibido al confirmar"',
  )
  .replace(
    "En producción el código debe gestionarse de manera segura desde el servidor. Esta demo utiliza pedidos ficticios del navegador.",
    "Usá el código privado recibido al confirmar tu pedido.",
  )
  .replaceAll(
    "COMPROBANTE DEMO",
    "COMPROBANTE INTERNO · NO VÁLIDO COMO FACTURA",
  )
  .replaceAll("Compra de demostración", "Pedido registrado en el comercio");
store.engine = store.engine.replaceAll(
  "comerciando.multirubro.",
  "comerciando.live.multirubro.",
);
store.engine = "const demoAPI=window.__remakeStoreAPI;\n" + store.engine;
const storeAst = parseAst(store.engine);
const categoryDecl = storeAst.body.find(
  (n) =>
    n.type === "VariableDeclaration" &&
    n.declarations.some((d) => d.id.name === "DEFAULT_CATEGORIES"),
);
if (categoryDecl) {
  const init = categoryDecl.declarations.find(
    (d) => d.id.name === "DEFAULT_CATEGORIES",
  ).init;
  store.engine =
    store.engine.slice(0, init.start) + "[]" + store.engine.slice(init.end);
}
store.engine +=
  "\nwindow.__setStoreCategories=categories=>{DEFAULT_CATEGORIES.splice(0,DEFAULT_CATEGORIES.length,...categories);setTimeout(()=>{initCatalog();drawGrid();},0);};";
store.engine +=
  '\nconst originalLiveSuccess=showSuccess;showSuccess=order=>{originalLiveSuccess(order);if(order.deliveryCode){const node=document.createElement("p");node.style.cssText="text-align:center;padding:16px;word-break:break-word";node.textContent="Código de entrega: "+order.deliveryCode+" · Conservalo para recibir el pedido.";document.querySelector("#modalMount")?.append(node);}};';
store.engine = store.engine
  .replaceAll("Recibimos tu pedido de demostración.", "Recibimos tu pedido.")
  .replaceAll(
    "Confirmación simulada; no representa un cobro ni un pedido enviado a un comercio real.",
    "Pedido registrado. El pago queda pendiente de confirmación por el comercio.",
  )
  .replaceAll(
    "El pago no se procesa online en esta maqueta.",
    "El pago se confirma manualmente en el comercio.",
  )
  .replaceAll(
    "Tienda multirubro de demostración · Datos ficticios",
    "Catálogo del comercio",
  );
store.engine = store.engine.replaceAll(
  "COMPROBANTE DE DEMOSTRACIÓN",
  "COMPROBANTE INTERNO",
);
new Function(store.engine);
writeFileSync(
  new URL("generated/store.js", dir),
  "export default " + JSON.stringify(store.engine) + ";\n",
);
writeFileSync(
  new URL("generated/store-template.js", dir),
  "export default " +
    JSON.stringify({ html: store.html, assets: store.assets }) +
    ";\n",
);
console.log("Remake prepared: authenticated entry, async commits, live store.");
