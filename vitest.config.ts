import { defineConfig } from "vitest/config";
import path from "path";

// Standalone from vite.config.ts on purpose: that config sets `root` to
// client/ for the browser build, which would hide tests living in shared/ and
// server/.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  test: {
    include: ["{shared,server,client}/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
