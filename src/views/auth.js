import { supabase } from "../lib/supabase.js";
import { escapeHtml as e } from "../utils/format.js";
export function renderAuth(
  message = "",
  recovery = false,
  onPasswordSaved = () => {},
) {
  document.querySelector("#app").innerHTML =
    `<section class="auth-screen"><div class="card auth-card"><div class="brand"><div class="logo">▲</div><div><b>comercIAndo</b><small>by Andes Solutions</small></div></div><h1>${recovery ? "Definir contraseña" : "Ingresar a Emprendedores"}</h1><p>Administrá tu comercio desde un solo lugar.</p><form id="authForm">${recovery ? "" : `<label>Email<input name="email" type="email" autocomplete="username" required></label>`}<label>Contraseña<input name="password" type="password" minlength="10" autocomplete="${recovery ? "new-password" : "current-password"}" required></label><p id="authError" role="alert">${e(message)}</p><button class="btn" type="submit">${recovery ? "Guardar contraseña" : "Ingresar"}</button></form>${recovery ? "" : '<button class="btn g" id="recover">Olvidé mi contraseña</button>'}</div></section>`;
  document.querySelector("#authForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const button = ev.submitter;
    button.disabled = true;
    const fields = new FormData(ev.target);
    const result = recovery
      ? await supabase.auth.updateUser({ password: fields.get("password") })
      : await supabase.auth.signInWithPassword({
          email: fields.get("email"),
          password: fields.get("password"),
        });
    if (result.error)
      document.querySelector("#authError").textContent = result.error.message;
    else if (recovery) {
      onPasswordSaved();
      history.replaceState({}, "", location.pathname);
      await supabase.auth.signOut();
      renderAuth("Contraseña guardada. Ingresá con tu email.");
    }
    button.disabled = false;
  };
  document.querySelector("#recover")?.addEventListener("click", async () => {
    const email = document.querySelector("[name=email]").value;
    if (!email) {
      document.querySelector("#authError").textContent =
        "Ingresá tu email para recibir el enlace de recuperación.";
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + "/?recovery=1",
    });
    document.querySelector("#authError").textContent = error
      ? error.message
      : "Si el email tiene acceso, recibirá un enlace para definir su contraseña.";
  });
  if (!supabase)
    document
      .querySelectorAll(".auth-card button,.auth-card input")
      .forEach((el) => (el.disabled = true));
}
