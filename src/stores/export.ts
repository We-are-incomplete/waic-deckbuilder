/**
 * エクスポートストアの仕様
 * 範囲: 画像読み込み待ち・タイムアウト・イベントクリーンアップの整合性保証。
 */
import { defineStore } from "pinia";
import { ref, nextTick, readonly } from "vue";
import html2canvas from "html2canvas-pro";
import { generateFileName, downloadCanvas } from "../utils";

import { useEventListener } from "@vueuse/core";

// エクスポートストア専用のエラー型
class ExportError extends Error {
  readonly type: "html2canvas" | "imageLoad" | "concurrency" | "unknown";
  readonly originalError: unknown;

  constructor(params: {
    type: "html2canvas" | "imageLoad" | "concurrency" | "unknown";
    message: string;
    originalError: unknown;
  }) {
    super(params.message);
    this.name = "ExportError";
    this.type = params.type;
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, ExportError.prototype);
  }
}

// URLをユーザー表示/ログ向けに簡易マスク
const redactUrl = (src?: string): string => {
  if (!src) return "不明な画像";
  try {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost";
    const u = new URL(src, base);
    if (u.protocol === "blob:") return "(blob)";
    if (u.protocol === "data:") return "(data-uri)";
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return `(${u.protocol.replace(":", "")})`;
    }
    const file = u.pathname.split("/").pop();
    return file || "(image)";
  } catch {
    // 解析不能なURLは生値を出さない（情報漏洩対策）
    return "(invalid-url)";
  }
};

const IMAGE_LOAD_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_IMAGE_LOAD_TIMEOUT_MS;
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 8000;
  // 上限 60s
  return Math.min(n, 60_000);
})();
export const useExportStore = defineStore("export", () => {
  const isSaving = ref<boolean>(false);

  /**
   * すべての画像の読み込み完了を待つ
   */
  const waitForImagesLoaded = (container: HTMLElement): Promise<void> => {
    return new Promise((resolve, reject) => {
      const images = container.querySelectorAll<HTMLImageElement>("img");

      if (images.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      let hasErrorOccurred = false;
      const stops: Array<() => void> = [];

      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const cleanupListeners = () => {
        for (const stop of stops) stop();
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        stops.length = 0;
      };

      timeoutId = setTimeout(() => {
        if (hasErrorOccurred) return;
        hasErrorOccurred = true;
        cleanupListeners();
        reject(
          new ExportError({
            type: "imageLoad",
            message: `画像の読み込みがタイムアウトしました (${loadedCount}/${images.length}枚読み込み済み)`,
            originalError: new Error("timeout"),
          }),
        );
        return;
      }, IMAGE_LOAD_TIMEOUT_MS);

      const checkComplete = () => {
        if (hasErrorOccurred) return;

        loadedCount++;
        if (loadedCount === images.length) {
          cleanupListeners();
          resolve();
        }
      };

      const handleImageError = (error: Event) => {
        if (hasErrorOccurred) return;
        hasErrorOccurred = true;
        cleanupListeners();
        reject(
          new ExportError({
            type: "imageLoad",
            message: `画像の読み込みに失敗しました: ${redactUrl(
              (error.target as HTMLImageElement)?.src,
            )}`,
            originalError: error,
          }),
        );
        return;
      };

      const handleAlreadyBroken = (img: HTMLImageElement) => {
        if (hasErrorOccurred) return;
        hasErrorOccurred = true;
        cleanupListeners();
        reject(
          new ExportError({
            type: "imageLoad",
            message: `画像の読み込みに失敗しました: ${redactUrl(img.src)}`,
            originalError: new Error("already-complete-broken"),
          }),
        );
        return;
      };

      for (const img of images) {
        if (hasErrorOccurred) break;
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          // 既に読み込み済みの画像
          checkComplete();
        } else if (img.complete) {
          // 完了しているが壊れている画像
          handleAlreadyBroken(img);
        } else {
          // まだ読み込み中の画像
          // lazy だとロードが進みづらいので即時ロードを促進
          if ("loading" in img && img.loading === "lazy") {
            img.loading = "eager";
          }
          const offLoad = useEventListener(img, "load", checkComplete, {
            once: true,
          });
          const offError = useEventListener(img, "error", handleImageError, {
            once: true,
          });
          stops.push(offLoad, offError);
        }
      }
    });
  };

  /**
   * デッキをPNG画像として保存
   */
  const saveDeckAsPng = async (
    deckName: string,
    exportContainer: HTMLElement,
  ): Promise<void> => {
    if (isSaving.value) {
      throw new ExportError({
        type: "concurrency",
        message: "現在エクスポート処理中です。完了後に再度お試しください。",
        originalError: null,
      });
    }
    if (!exportContainer) {
      throw new ExportError({
        type: "unknown",
        message: "エクスポートコンテナが見つかりません",
        originalError: null,
      });
    }

    isSaving.value = true;

    try {
      // DOMの更新を待つ
      await nextTick();

      // すべての画像の読み込み完了を待つ
      await waitForImagesLoaded(exportContainer);

      // Canvas生成
      const canvas = await html2canvas(exportContainer, {
        scale: 1,
        useCORS: true,
        logging: false,
        allowTaint: false,
      });

      // ダウンロード
      const filename = generateFileName(deckName);
      downloadCanvas(canvas, filename);

      console.debug(`デッキ画像を保存しました: ${filename}`);
    } catch (e) {
      const errorMessage = "デッキ画像の保存に失敗しました";
      console.error(errorMessage + ":", e);
      if (e instanceof ExportError) {
        throw e;
      }
      throw new ExportError({
        type: "unknown",
        message: errorMessage,
        originalError: e,
      });
    } finally {
      isSaving.value = false;
    }
  };

  return {
    isSaving: readonly(isSaving),
    saveDeckAsPng,
  };
});
