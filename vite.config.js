import { resolve } from "node:path";
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/fds26-recipe-lab/" : "/",
  plugins: [basicSsl()],
  server: {
    host: true,
    https: true,
  },
  preview: {
    host: true,
    https: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        balance: resolve(import.meta.dirname, "balance.html"),
      },
    },
  },
});
