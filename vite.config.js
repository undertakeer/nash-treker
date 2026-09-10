import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
  // воркер maplibre должен быть модулем: он подключается через import
  worker: { format: "es" },
  build: { target: "es2020", outDir: "dist" },
});
