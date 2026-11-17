import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
