import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Same-origin proxy so Gemini works from a phone on LAN (avoids browser CORS). */
const geminiProxy = {
  "/gemini-api": {
    target: "https://generativelanguage.googleapis.com",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/gemini-api/, ""),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: geminiProxy,
  },
  preview: {
    host: true,
    proxy: geminiProxy,
  },
});
