import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { assertIndependentSupabase } from "./scripts/emprendedores-isolation.mjs";
export default defineConfig(({ mode }) => {
  assertIndependentSupabase(loadEnv(mode, process.cwd(), "VITE_"));
  return {
    build: {
      rollupOptions: {
        input: Object.fromEntries(
          [
            "index.html",
            "panel/index.html",
            "administracion/index.html",
            "tienda/index.html",
          ].map((p) => [p, fileURLToPath(new URL("./" + p, import.meta.url))]),
        ),
      },
    },
  };
});
