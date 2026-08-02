import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { matchBriefApiPlugin } from "./vite.matchBrief";
import { alertsApiPlugin } from "./vite.alerts";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    matchBriefApiPlugin(),
    alertsApiPlugin(),
  ],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5050,
    strictPort: true,
  },
});
