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
  // デッキコードストア専用のエラー型
  type DeckCodeError =
    | { readonly type: "generation"; readonly message: string }
    | { readonly type: "copy"; readonly message: string }
    | { readonly type: "validation"; readonly message: string }
    | { readonly type: "decode"; readonly message: string };

  const error = ref<DeckCodeError | null>(null);
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
      error.value = { type: "generation", message: errorMessage };
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
      error.value = { type: "copy", message: errorMessage };
    }
  };

  /**
   * デッキコードからインポート
   */
  const importDeckFromCode = (availableCards: readonly Card[]): void => {
    error.value = null;

    // 入力検証：空文字列チェック
    if (!importDeckCode.value || importDeckCode.value.trim() === "") {
      const warningMessage = "デッキコードが空です";
      logger.warn(warningMessage);
      error.value = { type: "validation", message: warningMessage };
      return;
    }

    // 入力検証：基本的な形式チェック（カードIDを/で区切った形式）
    const trimmedCode = importDeckCode.value.trim();

    // デッキコードの最大長チェック
    const MAX_DECK_CODE_LENGTH = 2000; // 例として2000文字に設定
    if (trimmedCode.length > MAX_DECK_CODE_LENGTH) {
      const warningMessage = `デッキコードが長すぎます（最大${MAX_DECK_CODE_LENGTH}文字）`;
      logger.warn(warningMessage);
      error.value = { type: "validation", message: warningMessage };
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
      error.value = { type: "validation", message: warningMessage };
      return;
    }

    // 各カードIDのフォーマット検証
    const cardIdPattern = /^([A-Z]|ex|prm)(A|S|M|D)-\d+$/;
    const cardIds = trimmedCode.split("/");
    for (const cardId of cardIds) {
      if (!cardIdPattern.test(cardId)) {
        const warningMessage = `無効なカードID形式が含まれています: ${cardId}`;
        logger.warn(warningMessage);
        error.value = { type: "validation", message: warningMessage };
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

      const decodeResult = decodeDeckCode(trimmedCode, availableCards);
      logger.debug("デコード結果:", decodeResult);

      if (decodeResult.isOk()) {
        const importedCards = decodeResult.value;
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
          error.value = { type: "decode", message: warningMessage };
        }
      } else {
        // エラーの種類に応じてメッセージを設定
        let errorMessage: string;
        switch (decodeResult.error.type) {
          case "emptyCode":
            errorMessage = "デッキコードが空です";
            break;
          case "invalidCardId":
            errorMessage = `無効なカードIDが含まれています: ${decodeResult.error.invalidId}`;
            break;
          case "cardNotFound":
            errorMessage = `一部のカードが見つかりませんでした: ${decodeResult.error.notFoundIds.join(
              ", "
            )}`;
            break;
          default:
            errorMessage = "デッキコードのデコードに失敗しました";
        }
        logger.warn(errorMessage);
        logger.debug("入力されたデッキコード:", trimmedCode);
        error.value = { type: "decode", message: errorMessage };
      }
    } catch (e) {
      const errorMessage = "デッキコードの復元に失敗しました";
      logger.error(errorMessage + ":", e);
      logger.debug("入力されたデッキコード:", trimmedCode);
      error.value = { type: "decode", message: errorMessage };
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
