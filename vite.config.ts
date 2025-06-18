import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/waic-deckbuilder/",
  plugins: [vue(), tailwindcss()],
  server: {
    warmup: {
      clientFiles: ["./src/components/**/*.vue", "./src/utils/**/*.ts"],
    },
  },
});
