import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          if (moduleId.includes("@tanstack/react-query")) {
            return "query-vendor";
          }

          if (
            moduleId.includes("node_modules/react/") ||
            moduleId.includes("node_modules/react-dom/") ||
            moduleId.includes("node_modules/react-router")
          ) {
            return "react-vendor";
          }

          return undefined;
        },
      },
    },
  },
});
