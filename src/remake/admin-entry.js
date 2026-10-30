import { supabase, passwordSetupLink } from "../lib/supabase.js";
import { loadIdentity, watchSession } from "../auth/session.js";
import { renderAuth } from "../views/auth.js";
import { createRemakeBackend } from "./backend.js";
import engine from "./generated/admin.js";
import template from "./generated/admin-template.js";
import { installPlatformSound } from "./sounds.js";
installPlatformSound();
let mounted = false,
  loading = false,
  recovery =
    passwordSetupLink || new URLSearchParams(location.search).has("recovery");
async function start(event, session) {
  if (mounted) {
    if (!session) location.reload();
    return;
  }
  if (loading) return;
  if (!session) {
    renderAuth();
    return;
  }
  if (event === "PASSWORD_RECOVERY" || recovery) {
    renderAuth("", true, () => {
      recovery = false;
    });
    return;
  }
  loading = true;
  try {
    const profile = await loadIdentity(session);
    window.__remakeBackend = await createRemakeBackend(profile);
    const doc = new DOMParser().parseFromString(template.html, "text/html");
    for (const el of doc.head.querySelectorAll('style,link[rel="stylesheet"]'))
      document.head.append(el.cloneNode(true));
    document.body.innerHTML = doc.body.innerHTML;
    window.addEventListener("unhandledrejection", (ev) => {
      console.error(ev.reason);
      window.toast?.(
        "La operación no se completó: " +
          (ev.reason?.message || "Revisá la conexión"),
      );
      ev.preventDefault();
    });
    window.__remakeMountDone = new Promise((resolve, reject) => {
      window.__remakeMountResolve = resolve;
      window.__remakeMountReject = reject;
    });
    const script = document.createElement("script");
    script.textContent =
      "(async()=>{try{" +
      engine +
      "\nwindow.__remakeMountResolve();}catch(error){window.__remakeMountReject(error);}})();";
    document.body.append(script);
    await window.__remakeMountDone;
    for (const src of template.assets) {
      const el = document.createElement("script");
      el.src = new URL(src, location.href).href;
      document.body.append(el);
    }
    mounted = true;
  } catch (error) {
    if (!document.querySelector("#app"))
      document.body.innerHTML =
        '<div id="app"></div><div id="modalRoot"></div>';
    renderAuth("No pudimos abrir el comercio: " + error.message);
  } finally {
    loading = false;
  }
}
if (!supabase) renderAuth("Falta configurar Supabase.");
else {
  watchSession(start);
  const { data } = await supabase.auth.getSession();
  await start("INITIAL_SESSION", data.session);
}
