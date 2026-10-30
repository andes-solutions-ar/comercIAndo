// comercIAndo · Sonido unificado de confirmación para la administración.
// Un único AudioContext se reutiliza. Ninguna interacción dispara sonidos si
// el usuario desactivó "Sonidos de plataforma".
let context = null;
let lastPlayedAt = -Infinity;

export function installPlatformSound() {
  if (window.comerciandoUIBeep) return window.comerciandoUIBeep;

  function enabled() {
    const state = window.__getRemakeState?.();
    const initial = window.__remakeBackend?.initialState;
    return (state?.settings?.sound ?? initial?.settings?.sound) !== false;
  }

  function play(kind = "success") {
    if (!enabled()) return false;
    const now = performance.now();
    // Click + handler específico de la misma acción no deben sonar dos veces.
    if (now - lastPlayedAt < 85) return false;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      if (!context || context.state === "closed") context = new Audio();
      if (context.state === "suspended") void context.resume().catch(() => {});
      const at = context.currentTime + 0.004;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const error = kind === "error";
      // Bip digital corto, estilo lector de supermercado (no es audio grabado).
      osc.type = "square";
      osc.frequency.setValueAtTime(error ? 330 : 1050, at);
      osc.frequency.exponentialRampToValueAtTime(error ? 230 : 920, at + 0.105);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(error ? 0.011 : 0.014, at + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + (error ? 0.18 : 0.12));
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(at);
      osc.stop(at + (error ? 0.185 : 0.125));
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      lastPlayedAt = now;
      return true;
    } catch {
      return false;
    }
  }

  const api = Object.freeze({ play, get enabled() { return enabled(); } });
  window.comerciandoUIBeep = api;

  document.addEventListener("click", (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const control = event.target.closest(
      'button, a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], [role="button"], .switch-toggle'
    );
    if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
    if (control.closest("[inert]")) return;
    // En estos dos controles el escaneo informa éxito/error por su cuenta.
    if (control.matches("#v20Add, #stockScanContinue")) return;
    play("success");
  }, { capture: true, passive: true });

  document.addEventListener("change", (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (event.target.matches("select")) play("success");
  }, { capture: true, passive: true });

  window.addEventListener("pagehide", () => {
    if (context?.state === "running") void context.suspend().catch(() => {});
  });
  return api;
}
