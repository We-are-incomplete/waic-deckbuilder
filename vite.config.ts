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
        name: "KCGデッキメーカー",
        short_name: "KCG Maker",
        icons: [
          {
            src: "favicon.png",
            sizes: "1000x1000",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{avif,css,html,js,png,webmanifest}"],
      },
    }),
  ],
  server: {
    warmup: {
      clientFiles: ["./src/components/**/*.vue", "./src/utils/**/*.ts"],
    },
  },
});
