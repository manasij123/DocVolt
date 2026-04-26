import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// We mount the built site at /api/web/ on the FastAPI backend (StaticFiles)
// because only /api/* is routed to the backend by the ingress.
// All asset URLs and the SPA router base must reflect this prefix.
export default defineConfig({
  plugins: [react()],
  base: "/api/web/",
  server: { port: 5173 },
  build: { outDir: "dist", assetsDir: "assets", emptyOutDir: true },
});
