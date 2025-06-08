import { ref, type Ref } from "vue";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { encodeDeckCode, decodeDeckCode } from "../utils/deckCode";
import { logger } from "../utils/logger";
import { useToast } from "./useToast";

export function useDeckCode(deckCards: Ref<DeckCard[]>) {
  const deckCode = ref<string>("");
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);
  const error = ref<string | null>(null);

  const { showError, showSuccess } = useToast();

  /**
   * デッキコードを生成・表示
   */
  const generateAndShowDeckCode = (): void => {
    isGeneratingCode.value = true;
    error.value = null;
    try {
      deckCode.value = encodeDeckCode(deckCards.value);
      logger.debug("生成されたデッキコード:", deckCode.value);
      logger.debug("デッキカード数:", deckCards.value.length);
      logger.debug(
        "デッキ内容:",
        deckCards.value.map(
          (item: DeckCard) => `${item.card.id} x${item.count}`
        )
      );
      showDeckCodeModal.value = true;
    } catch (e) {
      const errorMessage = "デッキコードの生成に失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = errorMessage;
      showError(errorMessage);
    } finally {
      isGeneratingCode.value = false;
    }
  };

  /**
   * デッキコードをクリップボードにコピー
   */
  const copyDeckCode = async (): Promise<void> => {
    error.value = null;
    try {
      await navigator.clipboard.writeText(deckCode.value);
      showSuccess("デッキコードをコピーしました");
    } catch (e) {
      const errorMessage = "デッキコードのコピーに失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = errorMessage;
      showError(errorMessage);
    }
  };

  /**
   * デッキコードからインポート
   */
  const importDeckFromCode = (
    availableCards: readonly Card[],
    setDeckCards: (cards: DeckCard[]) => void
  ): void => {
    error.value = null;

    // 入力検証：空文字列チェック
    if (!importDeckCode.value || importDeckCode.value.trim() === "") {
      const warningMessage = "デッキコードが空です";
      logger.warn(warningMessage);
      error.value = warningMessage;
      showError(warningMessage);
      return;
    }

    // 入力検証：基本的な形式チェック（カードIDを/で区切った形式）
    const trimmedCode = importDeckCode.value.trim();

    // 空文字列や無効な文字が含まれていないかチェック
    if (
      trimmedCode.includes("//") ||
      trimmedCode.startsWith("/") ||
      trimmedCode.endsWith("/")
    ) {
      const warningMessage = "無効なデッキコード形式です";
      logger.warn(warningMessage);
      error.value = warningMessage;
      showError(warningMessage);
      return;
    }

    try {
      logger.debug("デッキコードをデコード中:", trimmedCode);
      logger.debug("利用可能カード数:", availableCards.length);
      logger.debug(
        "利用可能カード(最初の5件):",
        availableCards.slice(0, 5).map((c) => c.id)
      );

      const importedCards = decodeDeckCode(trimmedCode, availableCards);
      logger.debug("デコード結果:", importedCards);

      if (importedCards.length > 0) {
        setDeckCards(importedCards); // deckCardsを更新
        importDeckCode.value = "";
        showDeckCodeModal.value = false;
        showSuccess(
          `デッキをインポートしました（${importedCards.length}種類のカード）`
        );
      } else {
        const warningMessage =
          "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
        logger.warn(warningMessage);
        logger.debug("入力されたデッキコード:", trimmedCode);
        error.value = warningMessage;
        showError(warningMessage);
      }
    } catch (e) {
      const errorMessage = "デッキコードの復元に失敗しました";
      logger.error(errorMessage + ":", e);
      logger.debug("入力されたデッキコード:", trimmedCode);
      error.value = errorMessage;
      showError(errorMessage);
    }
  };

  /**
   * インポート用デッキコードを設定
   */
  const setImportDeckCode = (code: string): void => {
    importDeckCode.value = code;
  };

  return {
    deckCode,
    importDeckCode,
    isGeneratingCode,
    showDeckCodeModal,
    error,
    generateAndShowDeckCode,
    copyDeckCode,
    importDeckFromCode,
    setImportDeckCode,
  };
}
