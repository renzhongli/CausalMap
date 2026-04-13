import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@causalmap/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@causalmap/renderer": fileURLToPath(new URL("../../packages/renderer/src/index.ts", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        cluster: resolve(root, "cluster.html"),
      },
    },
  },
});