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
let admin = split("admin");
admin.engine = replaceFunction(
  admin.engine,
  "loadDB",
  "return structuredClone(window.__remakeBackend.initialState);",
);
admin.engine = replaceFunction(
  admin.engine,
  "persist",
  "DB.products=P;ensureCategories();ensureProductImages();return window.__remakeBackend.persist(DB);",
);
admin.engine = admin.engine.replace(
  "const originalPersist = persist;\npersist = function() { DB.revision = (DB.revision || 0) + 1; return originalPersist(); };",
  "",
);
admin.engine = replaceFunction(
  admin.engine,
  "commitChange",
  `const before=structuredClone(DB);try{change();if(!persist())throw Error('No se pudo guardar en el servidor');}catch(error){DB=before;P=DB.products;throw error;}updateCashHeader();`,
);
admin.engine = replaceFunction(
  admin.engine,
  "sessionUser",
  "return DB.users.find(u=>u[6]===window.__remakeBackend.profile.id)||null;",
);
admin.engine = replaceFunction(
  admin.engine,
  "ensureUserAccounts",
  "DB.users=window.__remakeBackend.users();DB.currentUserIndex=DB.users.findIndex(u=>u[6]===window.__remakeBackend.profile.id);",
);
admin.engine = admin.engine.replace(
  /const saleNum=Math\.max\(1042[^\n]+;/,
  "const saleNum=window.__remakeBackend.nextNumber();",
);
admin.engine = admin.engine.replace(
  "if(!order.stockApplied && order.items?.length)",
  "if(!order.backendOrderId && !order.stockApplied && order.items?.length)",
);
admin.engine = admin.engine.replace(
  "rows.map(x=>({name:x.name,qty:x.qty,price:x.price}))",
  "rows.map(x=>({name:x.name,qty:x.qty,price:x.price,productId:productMeta(P[x.index]).id}))",
);
admin.engine = admin.engine.replace(
  "return Math.max(0,Number(m.onlineUnits||0));}",
  "return Math.max(0,Number(m.onlineUnits||0))+Math.max(0,Number(m.webReserved||0));}",
);
// Retain the exact UI while making storage-dependent call chains asynchronous.
// Older prototype tabs must never inject operational localStorage into the live DB.
const storageListeners = parseAst(admin.engine).body.filter(
  (node) =>
    node.type === "ExpressionStatement" &&
    node.expression.type === "CallExpression" &&
    node.expression.arguments[0]?.value === "storage" &&
    admin.engine.slice(node.start, node.end).includes("STORAGE_KEY"),
);
for (const node of storageListeners.reverse())
  admin.engine =
    admin.engine.slice(0, node.start) + admin.engine.slice(node.end);
for (const expected of [
  "productId:productMeta(P[x.index]).id",
  "window.__remakeBackend.nextNumber()",
  "!order.backendOrderId",
])
  if (!admin.engine.includes(expected))
    throw Error("Remake/backend contract changed: " + expected);
const ast = parseAst(admin.engine);
const functions = [];
const calls = [];
const aliases = [];
const parents = new Map();
function nameOf(n) {
  if (n?.type === "Identifier") return n.name;
  if (n?.type === "MemberExpression" && !n.computed) return n.property.name;
  if (n?.type === "ChainExpression") return nameOf(n.expression);
  return null;
}
function visit(n, parent, fn) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) {
    for (const v of n) visit(v, parent, fn);
    return;
  }
  if (!n.type) return;
  parents.set(n, parent);
  if (
    [
      "FunctionDeclaration",
      "FunctionExpression",
      "ArrowFunctionExpression",
    ].includes(n.type)
  ) {
    let name = n.id?.name;
    if (!name && parent?.type === "VariableDeclarator")
      name = nameOf(parent.id);
    if (!name && parent?.type === "AssignmentExpression")
      name = nameOf(parent.left);
    fn = { node: n, name, async: n.async };
    functions.push(fn);
  }
  if (n.type === "CallExpression")
    calls.push({ node: n, name: nameOf(n.callee), fn });
  if (n.type === "VariableDeclarator") {
    const left = nameOf(n.id),
      right = nameOf(n.init);
    if (left && right) aliases.push([left, right]);
  }
  for (const [k, v] of Object.entries(n))
    if (k !== "type" && typeof v === "object") visit(v, n, fn);
}
visit(ast, null, null);
const mutations = new Set(["persist", "commitChange", "guarded", "nextNumber"]);
let changed = true;
while (changed) {
  changed = false;
  for (const [a, b] of aliases)
    if (mutations.has(b) && !mutations.has(a)) {
      mutations.add(a);
      changed = true;
    }
  for (const c of calls)
    if (mutations.has(c.name) && c.fn && !c.fn.async) {
      c.fn.async = true;
      if (c.fn.name) mutations.add(c.fn.name);
      changed = true;
    }
}
const edits = [];
for (const f of functions)
  if (f.async && !f.node.async)
    edits.push({ at: f.node.start, text: "async " });
for (const c of calls)
  if (mutations.has(c.name) && parents.get(c.node)?.type !== "AwaitExpression")
    edits.push({ at: c.node.start, text: "await " });
let engine = admin.engine;
for (const e of edits.sort((a, b) => b.at - a.at))
  engine = engine.slice(0, e.at) + e.text + engine.slice(e.at);
const exports = ast.body
  .filter((n) => n.type === "FunctionDeclaration")
  .map((n) => n.id.name);
engine +=
  '\nwindow.__syncRemakeRefs=()=>{P=DB.products;};window.__getRemakeState=()=>DB;window.__installRealUsers=()=>{V.user=window.__realUsersView;const previousConfig=V.cfg;V.cfg=()=>{const t=document.createElement(\'template\');t.innerHTML=previousConfig();t.content.querySelectorAll(\'.profile-switch\').forEach(el=>el.closest(\'section\')?.remove());return t.innerHTML+`<section class="card" style="margin-top:18px;padding:20px"><h2>Tienda conectada</h2><p>Publicá productos desde Catálogo virtual y asignales cupo online desde Stock.</p><label><input id="liveStoreOpen" type="checkbox" ${DB.settings.storeOpen?\'checked\':\'\'}> Recibir pedidos web</label><label style="display:block;margin:12px 0">Costo de envío (ARS) <input id="liveShipping" type="number" min="0" step="0.01" value="${Number(DB.settings.shipping||0)}"></label><label><input id="liveTransfer" type="checkbox" ${DB.settings.transferEnabled?\'checked\':\'\'}> Admitir transferencia con confirmación manual</label><p>Esta versión no ejecuta pagos online: los cobros se confirman manualmente.</p><button class="btn" onclick="saveLiveStoreSettings()">Guardar tienda</button> <a class="btn g" href="/tienda/" target="_blank" rel="noopener">Ver tienda</a></section>`;};};window.saveLiveStoreSettings=async()=>{const shipping=Number(document.getElementById(\'liveShipping\').value);if(!Number.isFinite(shipping)||shipping<0)return toast(\'Ingresá un costo de envío válido.\');await commitChange(()=>{DB.settings.storeOpen=document.getElementById(\'liveStoreOpen\').checked;DB.settings.shipping=shipping;DB.settings.transferEnabled=document.getElementById(\'liveTransfer\').checked;});go(\'cfg\');toast(\'Configuración de tienda guardada en el servidor.\');};\nObject.assign(window,{' +
  exports.join(",") +
  '});\nObject.defineProperties(window,{P:{configurable:true,get:()=>P},cart:{configurable:true,get:()=>cart},view:{configurable:true,get:()=>view}});\nwindow.__replaceRemakeState=state=>{DB=structuredClone(state);P=DB.products;ensureOperations();ensureUserAccounts();ensureRetailModel();window.closeModals();cart={};go(view);updateSessionBadge();};\nwindow.resetData=()=>toast("El borrado del backend requiere una operación administrativa explícita.");window.changeDemoProfile=()=>toast("La identidad se obtiene de Supabase Auth.");\nawait window.__remakeBackend.ready();';
// Validate generated syntax before writing a build input.
new Function("return (async()=>{" + engine + "})()");
writeFileSync(
  new URL("generated/admin.js", dir),
  "export default " + JSON.stringify(engine) + ";\n",
);
writeFileSync(
  new URL("generated/admin-template.js", dir),
  "export default " +
    JSON.stringify({ html: admin.html, assets: admin.assets }) +
    ";\n",
);
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
