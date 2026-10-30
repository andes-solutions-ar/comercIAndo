import { supabase } from "../lib/supabase.js";
import { rpc, query, edge } from "../services/api.js";
import { escapeHtml as escape } from "../utils/format.js";
export async function createRemakeBackend(profile) {
  let snapshot = await rpc("remake_load");
  let profiles = await query("profiles");
  let booting = true;
  let pending = false;
  let blockedElements = [];
  document.addEventListener(
    "keydown",
    (event) => {
      if (pending) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  const users = () =>
    profiles.map((p) => [
      p.full_name,
      p.access_level === "super_admin" ? "Superadministrador" : "Administrador",
      p.full_name.slice(0, 2).toUpperCase(),
      ["Ventas", "Productos", "Stock", "Reportes", "Usuarios", "Configuración"],
      p.active,
      "",
      p.id,
      {},
    ]);
  function busy(on) {
    pending = on;
    document.querySelector("#backendSaving")?.remove();
    if (on) {
      blockedElements = [...document.body.children].map((el) => [el, el.inert]);
      blockedElements.forEach(([el]) => {
        el.inert = true;
      });
      const el = document.createElement("div");
      el.id = "backendSaving";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;inset:0;z-index:999999;background:#081326aa;display:grid;place-items:center;color:white;font:600 18px system-ui;backdrop-filter:blur(2px)";
      el.textContent = "Guardando en el servidor…";
      document.body.append(el);
    } else {
      blockedElements.forEach(([el, wasInert]) => {
        if (el.isConnected) el.inert = wasInert;
      });
      blockedElements = [];
    }
  }
  async function persist(state) {
    if (booting) return true;
    if (pending) throw Error("Esperá a que termine el guardado actual.");
    busy(true);
    const requestId = crypto.randomUUID();
    let recovering = false;
    try {
      const payload = structuredClone(state);
      delete payload.users;
      delete payload.currentUserIndex;
      delete payload.revision;
      const oldPayload = structuredClone(snapshot.state);
      delete oldPayload.users;
      delete oldPayload.currentUserIndex;
      delete oldPayload.revision;
      if (JSON.stringify(payload) === JSON.stringify(oldPayload)) {
        state.revision = snapshot.version;
        return true;
      }
      // Reuse the exact request ID on a transport retry. Never replay against a new version.
      let result;
      try {
        result = await rpc("remake_commit", {
          expected_version: snapshot.version,
          request_id: requestId,
          next_state: payload,
        });
      } catch (error) {
        if (!error.code && /fetch|network/i.test(error.message || ""))
          result = await rpc("remake_commit", {
            expected_version: snapshot.version,
            request_id: requestId,
            next_state: payload,
          });
        else throw error;
      }
      snapshot = result;
      Object.assign(state, structuredClone(result.state), {
        users: users(),
        revision: result.version,
      });
      window.__syncRemakeRefs?.();
      return true;
    } catch (error) {
      const uncertain = !error.code;
      if (uncertain)
        error.message =
          "No se pudo confirmar el guardado. Revisá el historial antes de repetir la operación.";
      recovering = true;
      setTimeout(async () => {
        try {
          snapshot = await rpc("remake_load");
          window.__replaceRemakeState?.({
            ...snapshot.state,
            users: users(),
            revision: snapshot.version,
          });
          window.toast?.(
            (uncertain ? "Operación sin confirmar: " : "No se guardó: ") +
              error.message,
          );
        } catch {
          window.toast?.(
            "No se pudo verificar el resultado. Revisá la conexión y el historial antes de repetir la operación.",
          );
        } finally {
          busy(false);
        }
      }, 0);
      throw error;
    } finally {
      if (!recovering) busy(false);
    }
  }
  async function refresh() {
    if (pending) return;
    busy(true);
    try {
      snapshot = await rpc("remake_load");
      profiles = await query("profiles");
      window.__replaceRemakeState?.({
        ...snapshot.state,
        users: users(),
        revision: snapshot.version,
      });
    } finally {
      busy(false);
    }
  }
  function wireUsers() {
    window.V; // Roles are sourced exclusively from profiles, never from the operational document.
    window.__realUsersView = () =>
      `<div class="hd"><div><h1>Usuarios</h1><p>Accesos reales de Supabase Auth. Hasta tres administradores activos, además del superadministrador.</p></div>${profile.access_level === "super_admin" ? '<button class="btn" onclick="realInvite()">Invitar administrador</button>' : ""}</div><section class="card"><table><thead><tr><th>Nombre</th><th>Acceso</th><th>Estado</th><th></th></tr></thead><tbody>${profiles.map((p) => `<tr><td>${escape(p.full_name)}</td><td>${p.access_level === "super_admin" ? "Superadministrador" : "Administrador completo"}</td><td>${p.active ? "Activo" : "Inactivo"}</td><td>${profile.access_level === "super_admin" && p.access_level !== "super_admin" ? `<button class="btn g" onclick="realToggleUser('${p.id}')">${p.active ? "Desactivar" : "Activar"}</button>` : "Protegido"}</td></tr>`).join("")}</tbody></table></section>`;
    window.realInvite = () => {
      if (profile.access_level !== "super_admin") return;
      window.workModal(
        "Invitar administrador",
        "Se enviará un correo para que defina su propia contraseña.",
        `<form id="realInviteForm"><label>Nombre<input name="name" required maxlength="120"></label><label>Email<input name="email" type="email" required></label><p>Acceso administrativo completo al comercio. La invitación requiere un proveedor de correo habilitado para el destinatario.</p><button class="btn" type="submit">Enviar invitación</button></form>`,
      );
      document.querySelector("#realInviteForm").onsubmit = async (ev) => {
        ev.preventDefault();
        const b = ev.submitter;
        b.disabled = true;
        try {
          const f = new FormData(ev.target);
          await edge("admin-invite-user", {
            full_name: f.get("name"),
            email: f.get("email"),
            display_role: "Administrador",
            permissions: Object.fromEntries(
              [
                "dashboard",
                "pos",
                "sales",
                "payments",
                "catalog",
                "products",
                "stock",
                "deliveries",
                "users",
                "module",
                "settings",
              ].map((k) => [k, true]),
            ),
          });
          await refresh();
          window.toast("Invitación enviada.");
        } catch (error) {
          window.workError(error.message);
        } finally {
          b.disabled = false;
        }
      };
    };
    window.realToggleUser = async (id) => {
      const p = profiles.find((p) => p.id === id);
      if (!p || profile.access_level !== "super_admin") return;
      if (
        !confirm(
          `${p.active ? "Desactivar" : "Activar"} el acceso de ${p.full_name}?`,
        )
      )
        return;
      await rpc("update_admin", {
        payload: {
          id,
          full_name: p.full_name,
          display_role: p.display_role,
          permissions: p.permissions,
          active: !p.active,
        },
      });
      await refresh();
    };
  }
  return {
    profile,
    nextNumber: () => rpc("remake_next_number"),
    initialState: {
      ...snapshot.state,
      users: users(),
      revision: snapshot.version,
    },
    users,
    persist,
    async ready() {
      booting = false;
      wireUsers();
      window.__installRealUsers();
      document
        .querySelectorAll(".profile-switch")
        .forEach((el) => el.closest("section")?.remove());
      document.querySelector("#backendTools")?.remove();
      const bar = document.createElement("div");
      bar.id = "backendTools";
      bar.style.cssText =
        "position:fixed;right:14px;bottom:12px;z-index:1000;display:flex;gap:8px;font:12px system-ui";
      bar.innerHTML =
        '<button class="btn g sm" id="backendRefresh">Actualizar datos</button><button class="btn g sm" id="backendLogout">Cerrar sesión</button>';
      document.body.append(bar);
      bar.querySelector("#backendRefresh").onclick = () => {
        if (
          Object.keys(window.cart || {}).length &&
          !confirm("Se vaciará el carrito al actualizar. ¿Continuar?")
        )
          return;
        refresh().catch((e) => window.toast(e.message));
      };
      bar.querySelector("#backendLogout").onclick = async () => {
        await supabase.auth.signOut();
        location.reload();
      };
      window.openAccountForm = window.realInvite;
      window.deleteAccount = () =>
        window.toast("Usá Desactivar acceso para conservar la auditoría.");
      window.requestAccountReset = () =>
        window.toast(
          "Cada usuario puede pedir su enlace desde el formulario de ingreso.",
        );
      window.v8SignOut = async () => {
        await supabase.auth.signOut();
        location.reload();
      };
      await persist(window.__getRemakeState());
      window.go("home");
    },
    refresh,
  };
}
