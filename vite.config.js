import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 项目站点部署在子路径 /hu-chenfeng/ 下
  // 设置 base 确保构建产物中的资源引用都带上该前缀
  base: "/hu-chenfeng/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // 让生成物更利于静态部署
    target: "es2018",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
