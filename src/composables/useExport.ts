import { ref, shallowRef, nextTick } from "vue";
import html2canvas from "html2canvas-pro";
import type { DeckCard } from "../types";
import { EXPORT_CONFIG } from "../constants";
import {
  calculateCardWidth,
  generateFileName,
  downloadCanvas,
  handleError,
} from "../utils/export";

export function useExport() {
  const isSaving = ref<boolean>(false);
  const exportContainer = shallowRef<HTMLElement | null>(null);

  /**
   * デッキをPNG画像として保存
   */
  const saveDeckAsPng = async (
    deckName: string,
    deckCards: readonly DeckCard[]
  ): Promise<void> => {
    if (!exportContainer.value) return;

    isSaving.value = true;

    try {
      // DOMの更新を待つ
      await nextTick();

      // 少し待ってから画像生成（画像の読み込み完了を待つため）
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Canvas生成
      const canvas = await html2canvas(exportContainer.value, {
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
      handleError(e, "デッキ画像の保存に失敗しました");
    } finally {
      isSaving.value = false;
    }
  };

  return {
    isSaving,
    exportContainer,
    saveDeckAsPng,
    calculateCardWidth,
    EXPORT_CONFIG,
  };
}
