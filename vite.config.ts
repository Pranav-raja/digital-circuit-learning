import { defineConfig } from "vite";

// Root-level Vite config. The app lives at the repo root (this repo *is* Logic
// Lab), so index.html sits beside this file and src/ holds the code.
export default defineConfig({
  server: {
    port: 5173,
  },
});
