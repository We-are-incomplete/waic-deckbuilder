import { defineStore } from "pinia";
import { ref } from "vue";
import type { Card, DeckCard } from "../types";
import { encodeDeckCode, decodeDeckCode, logger } from "../utils";
import { useDeckStore } from "./deck";

import { fromAsyncThrowable } from "neverthrow";
import { sortDeckCards } from "../domain/sort";

export const useDeckCodeStore = defineStore("deckCode", () => {
  const deckCode = ref<string>("");
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);
  const error = ref<string | null>(null);
  const deckStore = useDeckStore();

  /**
   * デッキコードを生成・表示
   */
  const generateAndShowDeckCode = (): void => {
    isGeneratingCode.value = true;
    error.value = null;
    try {
      // デッキカードをソートしてからエンコード
      const sortedDeck = sortDeckCards(deckStore.deckCards);
      deckCode.value = encodeDeckCode(sortedDeck);
      logger.debug("生成されたデッキコード:", deckCode.value);
      logger.debug("デッキカード数:", sortedDeck.length);
      logger.debug(
        "デッキ内容:",
        sortedDeck.map((item: DeckCard) => `${item.card.id} x${item.count}`)
      );
      showDeckCodeModal.value = true;
    } catch (e) {
      const errorMessage = "デッキコードの生成に失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = errorMessage;
    } finally {
      isGeneratingCode.value = false;
    }
  };

  /**
   * デッキコードをクリップボードにコピー
   */
  const copyDeckCode = async (): Promise<void> => {
    error.value = null;

    // Clipboard APIを安全にラップ
    const safeClipboardWrite = fromAsyncThrowable(
      async (text: string) => {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard API is not supported");
        }
        await navigator.clipboard.writeText(text);
      },
      (error: unknown) => error
    );

    const result = await safeClipboardWrite(deckCode.value);

    if (result.isOk()) {
      logger.info("デッキコードをコピーしました");
    } else {
      const errorMessage = "デッキコードのコピーに失敗しました";
      logger.error(errorMessage + ":", result.error);
      error.value = errorMessage;
    }
  };

  /**
   * デッキコードからインポート
   */
  const importDeckFromCode = (availableCards: readonly Card[]): void => {
    const deckStore = useDeckStore();
    error.value = null;

    // 入力検証：空文字列チェック
    if (!importDeckCode.value || importDeckCode.value.trim() === "") {
      const warningMessage = "デッキコードが空です";
      logger.warn(warningMessage);
      error.value = warningMessage;
      return;
    }

    // 入力検証：基本的な形式チェック（カードIDを/で区切った形式）
    const trimmedCode = importDeckCode.value.trim();

    // デッキコードの最大長チェック
    const MAX_DECK_CODE_LENGTH = 2000; // 例として2000文字に設定
    if (trimmedCode.length > MAX_DECK_CODE_LENGTH) {
      const warningMessage = `デッキコードが長すぎます（最大${MAX_DECK_CODE_LENGTH}文字）`;
      logger.warn(warningMessage);
      error.value = warningMessage;
      return;
    }

    // 空文字列や無効な文字が含まれていないかチェック
    if (
      trimmedCode.includes("//") ||
      trimmedCode.startsWith("/") ||
      trimmedCode.endsWith("/")
    ) {
      const warningMessage = "無効なデッキコード形式です";
      logger.warn(warningMessage);
      error.value = warningMessage;
      return;
    }

    // 各カードIDのフォーマット検証
    const cardIdPattern = /^([A-Z]|ex|prm)(A|S|M|D)-\d+$/;
    const cardIds = trimmedCode.split("/");
    for (const cardId of cardIds) {
      if (!cardIdPattern.test(cardId)) {
        const warningMessage = `無効なカードID形式が含まれています: ${cardId}`;
        logger.warn(warningMessage);
        error.value = warningMessage;
        return;
      }
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
        deckStore.setDeckCards(importedCards);
        importDeckCode.value = "";
        showDeckCodeModal.value = false;
        logger.info(
          `デッキをインポートしました（${importedCards.length}種類のカード）`
        );
      } else {
        const warningMessage =
          "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
        logger.warn(warningMessage);
        logger.debug("入力されたデッキコード:", trimmedCode);
        error.value = warningMessage;
      }
    } catch (e) {
      const errorMessage = "デッキコードの復元に失敗しました";
      logger.error(errorMessage + ":", e);
      logger.debug("入力されたデッキコード:", trimmedCode);
      error.value = errorMessage;
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
});
