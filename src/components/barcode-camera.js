// Lectura local: no se envían imágenes ni video al backend.
// BarcodeDetector nativo si está disponible; ZXing remoto versionado como
// alternativa para navegadores que todavía no implementan BarcodeDetector.
// TODO producción: empaquetar ZXing en el bundle y fijar su integridad.
import { normalizeBarcode } from "../utils/barcodes.js";

const FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e", "code_128",
  "code_39", "itf", "codabar",
];

export function bindBarcodeCamera(trigger, preview, onDetected) {
  let active = null;
  const originalLabel = trigger.textContent;

  function stop() {
    const session = active;
    if (!session) return;
    active = null;
    session.closed = true;
    if (session.timer) clearTimeout(session.timer);
    session.controls?.stop();
    session.stream?.getTracks().forEach((track) => track.stop());
    if (session.video) session.video.srcObject = null;
    trigger.textContent = originalLabel;
    if (preview.isConnected) {
      preview.hidden = true;
      preview.replaceChildren();
    }
  }

  const observer = new MutationObserver(() => {
    if (!trigger.isConnected) {
      stop();
      observer.disconnect();
    }
  });
  observer.observe(document.querySelector("#modalRoot"), {
    childList: true,
    subtree: true,
  });

  trigger.onclick = async () => {
    if (active) {
      stop();
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      preview.hidden = false;
      preview.textContent = "La cámara requiere HTTPS y permiso del navegador. Podés ingresar el código manualmente o usar un lector USB.";
      return;
    }

    const session = { closed: false, controls: null, stream: null, video: null, timer: null };
    active = session;
    trigger.textContent = "Detener cámara";
    preview.hidden = false;
    preview.replaceChildren();
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.autoplay = true;
    video.muted = true;
    video.className = "barcode-video";
    const status = document.createElement("p");
    status.textContent = "Enfocá el código de barras dentro de la imagen.";
    preview.append(video, status);
    session.video = video;

    const finish = (value) => {
      if (active !== session || session.closed) return;
      let code;
      try {
        code = normalizeBarcode(value);
      } catch (error) {
        status.textContent = error.message;
        return;
      }
      if (!code) return;
      stop();
      onDetected(code);
    };

    try {
      let nativeFormats = [];
      if (typeof window.BarcodeDetector === "function") {
        nativeFormats = (await window.BarcodeDetector.getSupportedFormats())
          .filter((format) => FORMATS.includes(format));
      }
      if (session.closed) return;

      if (nativeFormats.length) {
        const detector = new window.BarcodeDetector({ formats: nativeFormats });
        session.stream = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: { ideal: "environment" } },
        });
        if (session.closed) {
          session.stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = session.stream;
        await video.play();
        const read = async () => {
          if (session.closed) return;
          try {
            if (video.readyState >= 2) {
              const matches = await detector.detect(video);
              if (matches[0]?.rawValue) finish(matches[0].rawValue);
            }
          } catch {
            status.textContent = "Ajustá el enfoque o la iluminación.";
          }
          if (!session.closed) session.timer = setTimeout(read, 160);
        };
        read();
      } else {
        // Import solo cuando sea necesario. Fallback manual si falla el CDN.
        const { BrowserMultiFormatReader } = await import(
          /* @vite-ignore */ "https://esm.sh/@zxing/browser@0.2.1?bundle"
        );
        if (session.closed) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          video,
          (result) => {
            if (result) finish(result.getText());
          },
        );
        session.controls = controls;
        if (session.closed) controls.stop();
      }
    } catch (error) {
      if (active !== session) return;
      stop();
      preview.hidden = false;
      preview.textContent =
        error?.name === "NotAllowedError"
          ? "No se autorizó la cámara. Permití su acceso o escribí el código manualmente."
          : "No fue posible iniciar el lector. Podés ingresar el código a mano o conectar un lector USB.";
    }
  };
  return stop;
}
