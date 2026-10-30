import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
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
});
