import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    rolldownOptions: {
      output: {
        // Strudels `evalScope` macht jeden Export eines Pakets global. Gekürzte interne Exportnamen der Chunks
        // (z. B. `m` für `drawPianoroll`) überschrieben sonst Strudels eigene Globale wie `m` (Mini-Notation).
        minifyInternalExports: false,
      },
    },
  },
});
