import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/waic-deckbuilder/",
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "神椿TCGデッキメーカー",
        short_name: "KCG Maker",
        display: "standalone",
        theme_color: "#000000",
        background_color: "#000000",
        description: "神椿TCGのデッキを構築・管理するためのツールです。",
        icons: [
          {
            src: "favicon.png",
            sizes: "1000x1000",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{css,html,js,png,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^\/waic-deckbuilder\/cards\/.*\.avif$/,
            handler: "CacheFirst",
            options: {
              cacheName: "cards-cache",
              expiration: {
                maxEntries: 1024,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern:
              /^\/waic-deckbuilder\/(sheet2|sheet|sheet_nogrid)\.avif$/,
            handler: "CacheFirst",
            options: {
              cacheName: "bg-cache",
              expiration: {
                maxEntries: 3,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    warmup: {
      clientFiles: ["./src/components/**/*.vue", "./src/utils/**/*.ts"],
    },
  },
});
