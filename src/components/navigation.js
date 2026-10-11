const I = {
  home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  pos: "M4 5h16v10H4zM8 19h8M12 15v4",
  sales: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  pay: "M3 6h18v12H3zM3 10h18",
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  prod: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  stock: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  ship: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
  user: "M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1a3 3 0 0 0-2-2.8",
  mod: "M12 3v18M3 12h18",
  cfg: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.5a7 7 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.5a7 7 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z",
};
const ic = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${I[k] || I.home}"/></svg>`;

const NAV = [
  ["", [["home", "Inicio"]]],
  [
    "Operación",
    [
      ["pos", "Punto de venta"],
      ["sales", "Ventas y pedidos"],
      ["pay", "Pagos"],
    ],
  ],
  [
    "Productos",
    [
      ["web", "Tienda / catálogo"],
      ["prod", "Productos y servicios"],
      ["stock", "Stock Pro"],
      ["ship", "Entrega segura"],
    ],
  ],
  [
    "Administración",
    [
      ["user", "Usuarios"],
      ["mod", "Módulo empresarial"],
      ["cfg", "Configuración"],
    ],
  ],
];
const NAMES = {};
export { I, ic, NAV };
