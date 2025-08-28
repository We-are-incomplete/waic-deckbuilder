/**
 * エクスポートストアの仕様
 * 目的: デッキDOMをPNGとして保存する。副作用(I/O)はこの層に集約し、外部例外は neverthrow の Result で返す。
 * 範囲: 画像読み込み待ち・タイムアウト・イベントクリーンアップの整合性保証。
 */
import { defineStore } from "pinia";
import { ref, nextTick, readonly } from "vue";
import html2canvas from "html2canvas-pro";
import { generateFileName, downloadCanvas, logger } from "../utils";
import { ok, err, fromPromise, fromThrowable, type Result } from "neverthrow";
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
      readonly type: "concurrency";
      readonly message: string;
      readonly originalError: unknown;
    }
  | {
      readonly type: "unknown";
      readonly message: string;
      readonly originalError: unknown;
    };

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
    return src.length > 120 ? src.slice(0, 120) + "…" : src;
  }
};

const IMAGE_LOAD_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_IMAGE_LOAD_TIMEOUT_MS;
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 8000;
})();
export const useExportStore = defineStore("export", () => {
  const isSaving = ref<boolean>(false);

  /**
   * すべての画像の読み込み完了を待つ
   */
  const waitForImagesLoaded = (
    container: HTMLElement,
  ): Promise<Result<void, ExportError>> => {
    return new Promise((resolve) => {
      const images = container.querySelectorAll<HTMLImageElement>("img");

      if (images.length === 0) {
        resolve(ok(undefined));
        return;
      }

      let loadedCount = 0;
      let hasErrorOccurred = false;
      const stops: Array<() => void> = [];

      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const cleanupListeners = () => {
        for (const stop of stops) stop();
        if (timeoutId) clearTimeout(timeoutId);
        stops.length = 0;
      };

      timeoutId = setTimeout(() => {
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
            message: `画像の読み込みに失敗しました: ${redactUrl(
              (error.target as HTMLImageElement)?.src,
            )}`,
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
            message: `画像の読み込みに失敗しました: ${redactUrl(img.src)}`,
            originalError: new Error("already-complete-broken"),
          }),
        );
      };

      images.forEach((img) => {
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
    if (isSaving.value) {
      return err({
        type: "concurrency",
        message: "現在エクスポート処理中です。完了後に再度お試しください。",
        originalError: null,
      });
    }
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
        logger.error("画像の読み込みに失敗しました:", imageLoadResult.error);
        return imageLoadResult; // 画像読み込みエラーを伝播
      }

      // Canvas生成 (neverthrow でラップ)
      const canvasResult = await fromPromise(
        html2canvas(exportContainer, {
          scale:
            typeof window !== "undefined"
              ? Math.min(2, Math.max(1, window.devicePixelRatio || 1))
              : 1,
          useCORS: true,
          logging: false,
          allowTaint: false,
        }),
        (e): ExportError => ({
          type: "html2canvas",
          message: "デッキ画像の保存に失敗しました",
          originalError: e,
        }),
      );
      if (canvasResult.isErr()) return err(canvasResult.error);
      const canvas = canvasResult.value;

      // ダウンロード（fromThrowableでラップ）
      const filename = generateFileName(deckName);
      const download = fromThrowable(
        downloadCanvas,
        (e): ExportError => ({
          type: "unknown",
          message: "デッキ画像の保存に失敗しました",
          originalError: e,
        }),
      );
      const dl = download(canvas, filename);
      if (dl.isErr()) {
        return err(dl.error);
      }

      logger.info(`デッキ画像を保存しました: ${filename}`);
    } catch (e) {
      const errorMessage = "デッキ画像の保存に失敗しました";
      logger.error(errorMessage + ":", e);
      return err({
        type: "unknown",
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
