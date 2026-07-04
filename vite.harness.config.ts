// TEMPORARY config for the board smoke harness build (not used by the app).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist-harness",
    rollupOptions: { input: "test-board.html" },
  },
});
