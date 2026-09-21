import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 43123,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:43124",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 43123,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:43124",
        changeOrigin: true,
      },
    },
  },
});
