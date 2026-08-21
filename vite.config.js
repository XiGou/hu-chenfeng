import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  // 使用相对路径引用资源，兼容任意部署位置：
  //  - GitHub Pages 项目站点（/hu-chenfeng/ 子路径）
  //  - Cloudflare Pages（根域名或任意子路径）
  //  - 本地静态托管 / 对象存储
  // 相对路径（"./"）让 index.html 内的资源引用无需域名前缀即可正确加载
  base: "./",
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
