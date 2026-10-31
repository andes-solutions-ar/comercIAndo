import { readFileSync, writeFileSync } from "node:fs";
import { parseAst } from "rollup/parseAst";
const dir = new URL("../src/remake/", import.meta.url);
const source = readFileSync(
  new URL("emprendedores-original.html", dir),
  "utf8",
);
let engine = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((m) => m[1])
  .join("\n");
const ast = parseAst(engine),
  edits = [];
for (const n of ast.body) {
  if (n.type !== "VariableDeclaration") continue;
  for (const d of n.declarations) {
    if (d.id.name === "SEED") edits.push([n.start, n.end, ""]);
    if (d.id.name === "state")
      edits.push([n.start, n.end, "let state=window.__lite.state();"]);
  }
}
for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0]))
  engine = engine.slice(0, start) + text + engine.slice(end);
engine = engine
  .replace(
    "const id='V-'+String(1001+state.sales.length)",
    "const id='#'+window.__liteSaleNumber",
  )
  .replace(
    "total:Math.max(0,cartTotal()-discount),payment",
    "total:Math.round(Math.max(0,cartTotal()-discount)*100)/100,discount,payment",
  )
  .replaceAll(
    "id:'P-'+String(101+state.deliveries.length)",
    "id:'P-'+window.__liteSaleNumber",
  )
  .replace(
    "p.stock<=0?'disabled':''",
    "p.stock-(p.reserved||0)<=0||p.enabled===false?'disabled':''",
  )
  .replace(
    "p.name.toLowerCase().includes(searchTerm.toLowerCase())",
    "(p.name+' '+p.barcode).toLowerCase().includes(searchTerm.toLowerCase())",
  )
  .replace(
    "${p.stock} u. disp.",
    "${Math.max(0,p.stock-(p.reserved||0))} u. disp.",
  )
  .replace(
    "(cart[p.id]||0)>=p.stock",
    "(cart[p.id]||0)>=p.stock-(p.reserved||0)",
  )
  .replace(
    "Math.min(p.stock,(cart[id]||0)",
    "Math.min(p.stock-(p.reserved||0),(cart[id]||0)",
  )
  .replace(
    "new Date(x).toLocaleDateString",
    "(x?new Date(x).toLocaleDateString",
  )
  .replace(
    "hour:'2-digit',minute:'2-digit'});",
    "hour:'2-digit',minute:'2-digit'}):'Sin fecha registrada');",
  )
  .replace("/state.products.length)", "/(state.products.length||1))")
  .replace(
    "Buen día, Marina 👋",
    "Buen día, ${esc(window.__remakeBackend.profile.full_name.split(' ')[0])} 👋",
  )
  .replace(
    "${i<2?action(i===0?'Preparar':'Entregar'",
    "${d.web&&!d.paid?action('Confirmar cobro','pay-order:'+d.id,''):''}${i<2?action(i===0?'Preparar':'Entregar'",
  )
  .replace(
    "['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((n,i)=>`<div class=\"lite-column\" style=\"height:${[38,65,45,80,52,92,64][i]}%\"><span>${n}</span></div>`).join('')",
    "salesChart()",
  )
  .replace(
    "document.documentElement.dataset.theme='dark';render();",
    "document.documentElement.dataset.theme=state.theme;render();",
  );
const textChanges = new Map([
  [
    "Operaciones simuladas para esta maqueta.",
    "Operaciones guardadas en el comercio.",
  ],
  [
    "Representación de ventas recientes de la maqueta.",
    "Ventas registradas durante los últimos siete días.",
  ],
  [
    "Todos los importes y actividades son ficticios.",
    "Importes de las ventas cobradas.",
  ],
  ["Acumulado simulado", "Acumulado registrado"],
  ["Facturación simulada", "Ventas cobradas"],
  ["Unidades en ventas simuladas.", "Unidades en ventas registradas."],
  [
    "Estos cambios afectan únicamente a la maqueta abierta.",
    "Datos guardados en el comercio.",
  ],
  [
    "Tope de usuarios permitido por Emprendedores (simulación).",
    "Accesos administrativos reales del comercio.",
  ],
  [
    "Las invitaciones no se envían realmente.",
    "Los accesos se gestionan mediante Supabase Auth.",
  ],
  [
    "Operación simulada: no se realiza un cobro real ni se emiten comprobantes fiscales.",
    "Registro de cobro manual. Verificá el pago antes de confirmar; no se emiten comprobantes fiscales.",
  ],
  ["Venta registrada en la maqueta", "Venta guardada en el servidor"],
  ["Producto guardado en la maqueta", "Producto guardado en el servidor"],
  ["en esta maqueta.", "en este formulario."],
  [
    "Creá un pedido ficticio para recorrer el flujo.",
    "Registrá una entrega o retiro del comercio.",
  ],
  ["Pedido creado en la maqueta", "Pedido guardado en el servidor"],
  ["Operación simulada.", "Venta registrada en el comercio."],
  [
    "Elegí qué artículos mostrar en un catálogo público de ejemplo.",
    "Elegí qué artículos mostrar en la vista previa de tu catálogo.",
  ],
  [
    "Vista de prueba: no genera ni publica una tienda real.",
    "Visibilidad guardada en el comercio. Consultá el resultado en Vista previa.",
  ],
  [
    "Vista previa local. No existe una tienda online publicada.",
    "Vista previa de los productos seleccionados.",
  ],
]);
for (const [a, b] of textChanges) engine = engine.replaceAll(a, b);
engine += "\n" + readFileSync(new URL("lite-ui.js", dir), "utf8");
new Function("return (async()=>{" + engine + "})()");
let html = source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(
    /<title>[\s\S]*?<\/title>/,
    "<title>ComercIAndo Emprendedores · v0.5.1</title>",
  )
  .replace("MAQUETA v0.5", "v0.5.1")
  .replace("Emprendedor · 2/3 usuarios", "Emprendedor");
writeFileSync(
  new URL("generated/admin.js", dir),
  "export default " + JSON.stringify(engine) + ";\n",
);
writeFileSync(
  new URL("generated/admin-template.js", dir),
  "export default " + JSON.stringify({ html, assets: [] }) + ";\n",
);
console.log(
  "Emprendedores v0.5.1: accepted design, authenticated server operations, no demo seed.",
);
