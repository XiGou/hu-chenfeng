import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * 本地开发服务器中间件：
 * 拦截开发模式下对 /选读/:id.html 或 /选读/:id 的请求，
 * 动态读取 detail.html 模板并注入当前 id，使 `npm run dev` 能直接预览与跳转各选读详情页。
 */
function devDetailRoutePlugin() {
  return {
    name: "dev-detail-route",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        let decodedPath = "";
        try {
          decodedPath = decodeURIComponent(req.url.split("?")[0]);
        } catch {
          decodedPath = req.url.split("?")[0];
        }
        const match = decodedPath.match(/^\/选读\/(\d+)(?:\.html)?$/);
        if (match) {
          const id = match[1];
          const templatePath = path.resolve(__dirname, "detail.html");
          if (!fs.existsSync(templatePath)) return next();
          let html = fs.readFileSync(templatePath, "utf8");
          // 动态注入 data-id 供 src/main/detail.js 读取
          html = html.replace('<div id="app"></div>', `<div id="app" data-id="${id}"></div>`);
          // 修正 dev 模式下子目录脚本与静态资源引用，使其指向绝对根路径
          html = html
            .replace(/src="\.\/src\//g, 'src="/src/')
            .replace(/href="\.\/favicons\//g, 'href="/favicons/')
            .replace(/\.\/favicons\//g, '/favicons/');
          try {
            html = await server.transformIndexHtml(req.url, html);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.statusCode = 200;
            res.end(html);
            return;
          } catch (e) {
            return next(e);
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // 使用相对路径引用资源，兼容任意部署位置：
  //  - GitHub Pages 项目站点（/hu-chenfeng/ 子路径）
  //  - Cloudflare Pages（根域名或任意子路径）
  //  - 本地静态托管 / 对象存储
  // 相对路径（"./"）让 index.html 内的资源引用无需域名前缀即可正确加载
  base: "./",
  plugins: [vue(), devDetailRoutePlugin()],
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
    // 站彻底 MPA —— 每个栏目独立 URL 页
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        viewpoints: fileURLToPath(new URL("./viewpoints.html", import.meta.url)),
        quotations: fileURLToPath(new URL("./quotations.html", import.meta.url)),
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
        pure: fileURLToPath(new URL("./pure.html", import.meta.url)),
        detail: fileURLToPath(new URL("./detail.html", import.meta.url)),
      },
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
