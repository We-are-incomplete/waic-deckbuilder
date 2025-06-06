import { ref, nextTick } from "vue";
import html2canvas from "html2canvas-pro";
import { EXPORT_CONFIG } from "../constants";
import type { DeckCard } from "../types";
import {
  calculateCardWidth,
  generateFileName,
  downloadCanvas,
  handleError,
} from "../utils/export";

export function useExport() {
  const isSaving = ref<boolean>(false);

  /**
   * デッキをPNG画像として保存
   */
  const saveDeckAsPng = async (
    deckName: string,
    deckCards: DeckCard[],
    exportContainer: HTMLElement
  ): Promise<void> => {
    if (!exportContainer) return;

    isSaving.value = true;

    try {
      // DOMの更新を待つ
      await nextTick();

      // 少し待ってから画像生成（画像の読み込み完了を待つため）
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      handleError(e, "デッキ画像の保存に失敗しました");
    } finally {
      isSaving.value = false;
    }
  };

  return {
    isSaving,
    saveDeckAsPng,
    calculateCardWidth,
    EXPORT_CONFIG,
  };
}
