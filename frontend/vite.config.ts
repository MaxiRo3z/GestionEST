import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// La config de vitest vive aparte, en vitest.config.ts: mezclar acá el tipo
// `test` de vitest con este `defineConfig` de vite rompía "npm run build"
// (tsc -b) por un choque de tipos entre la copia de "vite" que trae vitest
// como dependencia anidada y la del proyecto.
export default defineConfig({
  plugins: [react()],
})
