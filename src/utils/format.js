export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (n) =>
  "$ " +
  Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
export const date = (value) =>
  value
    ? new Date(value).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
export const day = (value) =>
  new Date(value).toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
export const today = () => day(new Date());
export const sum = (rows, field) =>
  rows.reduce((n, r) => n + Number(r[field] || 0), 0);
