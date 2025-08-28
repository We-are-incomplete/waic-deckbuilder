import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";
import { startImageCacheMaintenance, destroyImageCache } from "./utils/image";

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.mount("#app");

// クライアントサイドでのみ画像キャッシュのメンテナンスを開始
if (!import.meta.env.SSR) {
  startImageCacheMaintenance();
}
// HMR時にクリーンアップ
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyImageCache();
  });
}
