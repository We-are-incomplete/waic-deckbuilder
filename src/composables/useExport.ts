import { ref, nextTick } from "vue";
import html2canvas from "html2canvas-pro";
import { EXPORT_CONFIG } from "../constants/export";
import { generateFileName, downloadCanvas } from "../utils/export";
import { useToast } from "./useToast"; // useToastをインポート

export function useExport() {
  const isSaving = ref<boolean>(false);
  const { showError } = useToast(); // useToastを初期化

  /**
   * すべての画像の読み込み完了を待つ
   */
  const waitForImagesLoaded = (container: HTMLElement): Promise<void> => {
    return new Promise((resolve, reject) => {
      const images = container.querySelectorAll("img");

      if (images.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      let hasError = false;

      const cleanupListeners = () => {
        images.forEach((img) => {
          img.removeEventListener("load", checkComplete);
          img.removeEventListener("error", handleImageError);
        });
      };

      const checkComplete = () => {
        if (hasError) return;

        loadedCount++;
        if (loadedCount === images.length) {
          cleanupListeners();
          resolve();
        }
      };

      const handleImageError = (error: Event) => {
        if (hasError) return;
        hasError = true;
        cleanupListeners();
        reject(
          new Error(
            `画像の読み込みに失敗しました: ${
              (error.target as HTMLImageElement)?.src
            }`
          )
        );
      };

      images.forEach((img) => {
        if (img.complete && img.naturalHeight !== 0) {
          // 既に読み込み済みの画像
          checkComplete();
        } else {
          // まだ読み込み中の画像
          img.addEventListener("load", checkComplete, { once: true });
          img.addEventListener("error", handleImageError, { once: true });
        }
      });
    });
  };

  /**
   * デッキをPNG画像として保存
   */
  const saveDeckAsPng = async (
    deckName: string,
    exportContainer: HTMLElement
  ): Promise<void> => {
    if (!exportContainer) return;

    isSaving.value = true;

    try {
      // DOMの更新を待つ
      await nextTick();

      // すべての画像の読み込み完了を待つ
      await waitForImagesLoaded(exportContainer);

      // Canvas生成
      const canvas = await html2canvas(exportContainer, {
        scale: 1,
        width: EXPORT_CONFIG.canvas.width,
        height: EXPORT_CONFIG.canvas.height,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: EXPORT_CONFIG.canvas.backgroundColor,
      });

      // ダウンロード
      const filename = generateFileName(deckName);
      downloadCanvas(canvas, filename);

      console.log(`デッキ画像を保存しました: ${filename}`);
    } catch (e) {
      showError("デッキ画像の保存に失敗しました。"); // エラーメッセージをトーストで表示
      console.error("デッキ画像の保存に失敗しました:", e); // ロギングを直接行う
    } finally {
      isSaving.value = false;
    }
  };

  return {
    isSaving,
    saveDeckAsPng,
  };
}
