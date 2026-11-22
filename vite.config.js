import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1", // IPv4 explicite : "localhost" ne pointait que vers [::1] sur cette machine
    port: 5173,
    strictPort: true,
    open: true          // ouvre le navigateur au lancement de `npm run dev`
  },
  preview: { host: "127.0.0.1", port: 4173 }
});
