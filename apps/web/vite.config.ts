import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Overridable so the end-to-end tests can run their own copy next to your dev servers.
const webPort = Number(process.env.WEB_PORT ?? 3000);
const apiPort = Number(process.env.API_PORT ?? 4000);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    port: webPort,
    strictPort: true,
    // The API lives behind /api on the same origin, so session cookies just work.
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
});
