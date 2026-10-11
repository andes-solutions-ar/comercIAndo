import "./styles.css";
import { supabase, passwordSetupLink } from "./lib/supabase.js";
import { loadIdentity, watchSession } from "./auth/session.js";
import { renderAuth } from "./views/auth.js";
let generation = 0;
let mountedUser = null;
let passwordSetup =
  passwordSetupLink || new URLSearchParams(location.search).has("recovery");
async function resolveSession(event, session) {
  if (event === "TOKEN_REFRESHED" && session?.user?.id === mountedUser) return;
  if (event === "INITIAL_SESSION" && session?.user?.id === mountedUser) return;
  const current = ++generation;
  document.querySelector("#modalRoot").replaceChildren();
  if (!session) {
    mountedUser = null;
    renderAuth();
    return;
  }
  if (event === "PASSWORD_RECOVERY" || passwordSetup) {
    passwordSetup = true;
    renderAuth("", true, () => {
      passwordSetup = false;
    });
    return;
  }
  document.querySelector("#app").innerHTML =
    '<div class="auth-screen" role="status">Verificando acceso…</div>';
  try {
    const profile = await loadIdentity(session);
    if (current !== generation) return;
    const { mountApplication } = await import("./application.js");
    if (current !== generation) return;
    mountedUser = session.user.id;
    await mountApplication(profile);
  } catch (error) {
    if (current === generation) {
      mountedUser = null;
      renderAuth(error.message);
    }
  }
}
if (location.pathname === "/catalogo") {
  import("./views/catalog.js").then((m) => m.mountPublicCatalog());
} else if (!supabase)
  renderAuth("Faltan las variables de entorno de Supabase.");
else {
  watchSession(resolveSession);
  supabase.auth
    .getSession()
    .then(({ data, error }) =>
      error
        ? renderAuth(error.message)
        : resolveSession("INITIAL_SESSION", data.session),
    );
}
