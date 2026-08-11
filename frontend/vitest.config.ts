import { defineConfig } from "vitest/config";

// Config separada de vite.config.ts a propósito (ver comentario ahí): evita
// mezclar el plugin de React (que trae su propia copia de "vite" como
// dependencia) con los tipos de "vitest/config", lo cual rompía "tsc -b".
// Los tests actuales no necesitan el plugin de React: no escriben JSX.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
