import { escapeHtml as e, money } from "../utils/format.js";
import { ic } from "./navigation.js";
export const head = (title, subtitle, actions = "") =>
  `<div class="hd"><div><h1>${e(title)}</h1><p>${e(subtitle)}</p></div><div class="r">${actions}</div></div>`;
export const button = (label, action, id = "", style = "") =>
  `<button class="btn ${style}" data-action="${action}" data-id="${e(id)}">${e(label)}</button>`;
export const badge = (value) =>
  `<span class="pill ${["Pendiente", "Pedido", "Preparado", "Enviado"].includes(value) ? "w" : ["Cancelada", "Cancelado", "Crítico", "Inactivo"].includes(value) ? "b" : ""}">${e(value)}</span>`;
export const empty = (label = "No hay registros todavía.") =>
  `<div class="empty">${e(label)}</div>`;
export const table = (headers, rows) =>
  `<div class="card table-scroll"><table><thead><tr>${headers.map((x) => `<th>${e(x)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((cells) => `<tr>${cells.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">${empty()}</td></tr>`}</tbody></table></div>`;
export const kpis = (values) =>
  `<div class="card kpis">${values.map(([label, value, detail = ""]) => `<div><span>${e(label)}</span><strong class="num">${e(value)}</strong><small>${e(detail)}</small></div>`).join("")}</div>`;
export const tile = (p, small = false) =>
  `<span class="tile ${small ? "tiny" : ""}" style="background:hsl(${Number(p.visual_hue) || 0} 70% 92%);color:hsl(${Number(p.visual_hue) || 0} 55% 32%)">${e(
    p.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join(""),
  )}</span>`;
export const input = (label, name, value = "", type = "text", extra = "") =>
  `<label class="form-field">${e(label)}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
export const select = (label, name, values, current) =>
  `<label class="form-field">${e(label)}<select name="${name}">${values
    .map((v) => {
      const [value, text] = Array.isArray(v) ? v : [v, v];
      return `<option value="${e(value)}" ${String(current) === String(value) ? "selected" : ""}>${e(text)}</option>`;
    })
    .join("")}</select></label>`;
export const check = (label, name, checked = false, disabled = false) =>
  `<label class="switch-row"><b>${e(label)}</b><input type="checkbox" name="${name}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}></label>`;
export function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4000);
}
let previousFocus;
export function closeModal() {
  document.querySelector("#modalRoot").replaceChildren();
  document.body.classList.remove("modal-open");
  previousFocus?.focus();
}
export function modal(title, content, onSubmit, wide = false) {
  previousFocus = document.activeElement;
  const root = document.querySelector("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop open"><section class="modal-box ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><h2 id="modalTitle">${e(title)}</h2><button class="btn g sm" type="button" data-close aria-label="Cerrar">✕</button></div>${onSubmit ? '<form id="dialogForm">' : ""}${content}<p id="dialogError" role="alert"></p>${onSubmit ? '<div class="dialog-actions"><button type="button" class="btn g" data-close>Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>' : ""}</section></div>`;
  document.body.classList.add("modal-open");
  root
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = closeModal));
  root.querySelector(".modal-backdrop").addEventListener("click", (ev) => {
    if (ev.target.classList.contains("modal-backdrop")) closeModal();
  });
  const form = root.querySelector("form");
  if (form)
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      ev.submitter.disabled = true;
      try {
        await onSubmit(new FormData(form), form);
        closeModal();
      } catch (err) {
        root.querySelector("#dialogError").textContent = err.message;
        ev.submitter.disabled = false;
      }
    };
  const dialog = root.querySelector("[role=dialog]");
  dialog.onkeydown = (ev) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeModal();
    }
    if (ev.key === "Tab") {
      const all = [
        ...dialog.querySelectorAll("input,select,textarea,button,a[href]"),
      ].filter((x) => !x.disabled && x.getClientRects().length);
      const first = all[0],
        last = all.at(-1);
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  };
  (dialog.querySelector("input,select,button") || dialog).focus();
}
export const formValues = (form) => Object.fromEntries(form.entries());
export const productOptions = (products) =>
  products
    .filter((p) => p.active)
    .map((p) => [p.id, p.name + " — " + money(p.price)]);
