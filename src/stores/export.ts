import { defineStore } from "pinia";
import { ref, nextTick, readonly } from "vue";
import html2canvas from "html2canvas-pro";
import { generateFileName, downloadCanvas, logger } from "../utils";
import { ok, err, type Result } from "neverthrow";
import { useEventListener } from "@vueuse/core";

// エクスポートストア専用のエラー型
type ExportError =
  | {
      readonly type: "html2canvas";
      readonly message: string;
      readonly originalError: unknown;
    }
  | {
      readonly type: "imageLoad";
      readonly message: string;
      readonly originalError: unknown;
    }
  | {
      readonly type: "unknown";
      readonly message: string;
      readonly originalError: unknown;
    };

export const useExportStore = defineStore("export", () => {
  const isSaving = ref<boolean>(false);

  /**
   * すべての画像の読み込み完了を待つ
   */
  const waitForImagesLoaded = (
    container: HTMLElement,
  ): Promise<Result<void, ExportError>> => {
    return new Promise((resolve) => {
      const images = container.querySelectorAll("img");

      if (images.length === 0) {
        resolve(ok(undefined));
        return;
      }

      let loadedCount = 0;
      let hasErrorOccurred = false;
      const stops: Array<() => void> = [];

      const IMAGE_LOAD_TIMEOUT_MS = 8000;
      const timeoutId = window.setTimeout(() => {
        if (hasErrorOccurred) return;
        hasErrorOccurred = true;
        cleanupListeners();
        resolve(
          err({
            type: "imageLoad",
            message: `画像の読み込みがタイムアウトしました (${loadedCount}/${images.length}枚読み込み済み)`,
            originalError: new Error("timeout"),
          }),
        );
      }, IMAGE_LOAD_TIMEOUT_MS);

      const cleanupListeners = () => {
        for (const stop of stops) stop();
        clearTimeout(timeoutId);
      };

      const checkComplete = () => {
        if (hasErrorOccurred) return;

        loadedCount++;
        if (loadedCount === images.length) {
          cleanupListeners();
          resolve(ok(undefined));
        }
      };

      const handleImageError = (error: Event) => {
        if (hasErrorOccurred) return;
        hasErrorOccurred = true;
        cleanupListeners();
        resolve(
          err({
            type: "imageLoad",
            message: `画像の読み込みに失敗しました: ${
              (error.target as HTMLImageElement)?.src || "不明な画像"
            }`,
            originalError: error,
          }),
        );
      };

      const handleAlreadyBroken = (img: HTMLImageElement) => {
        if (hasErrorOccurred) return;
        hasErrorOccurred = true;
        cleanupListeners();
        resolve(
          err({
            type: "imageLoad",
            message: `画像の読み込みに失敗しました: ${img.src || "不明な画像"}`,
            originalError: new Error("already-complete-broken"),
          }),
        );
      };

      images.forEach((img) => {
        if (img.complete && img.naturalHeight !== 0) {
          // 既に読み込み済みの画像
          checkComplete();
        } else if (img.complete) {
          // 完了しているが壊れている画像
          handleAlreadyBroken(img);
        } else {
          // まだ読み込み中の画像
          const offLoad = useEventListener(img, "load", checkComplete, {
            once: true,
          });
          const offError = useEventListener(img, "error", handleImageError, {
            once: true,
          });
          stops.push(offLoad, offError);
        }
      });
    });
  };

  /**
   * デッキをPNG画像として保存
   */
  const saveDeckAsPng = async (
    deckName: string,
    exportContainer: HTMLElement,
  ): Promise<Result<void, ExportError>> => {
    if (!exportContainer) {
      return err({
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
      const imageLoadResult = await waitForImagesLoaded(exportContainer);
      if (imageLoadResult.isErr()) {
        return imageLoadResult; // 画像読み込みエラーを伝播
      }

      // Canvas生成
      const canvas = await html2canvas(exportContainer, {
        scale: 1,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      // ダウンロード
      const filename = generateFileName(deckName);
      downloadCanvas(canvas, filename);

      logger.info(`デッキ画像を保存しました: ${filename}`);
    } catch (e) {
      const errorMessage = "デッキ画像の保存に失敗しました";
      logger.error(errorMessage + ":", e);
      return err({
        type: "html2canvas",
        message: errorMessage,
        originalError: e,
      });
    } finally {
      isSaving.value = false;
    }
    return ok(undefined);
  };

  return {
    isSaving: readonly(isSaving),
    saveDeckAsPng,
  };
});
