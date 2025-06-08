import { ref, type Ref } from "vue";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { encodeDeckCode, decodeDeckCode } from "../utils/deckCode";
import { logger } from "../utils/logger";
import { useToast } from "./useToast";
import {
  createNaturalSort,
  createKindSort,
  createTypeSort,
} from "../utils/sort";

// ソート関数インスタンス
const naturalSort = createNaturalSort();
const kindSort = createKindSort();
const typeSort = createTypeSort();

export function useDeckCode(deckCards: Ref<DeckCard[]>) {
  const deckCode = ref<string>("");
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);
  const error = ref<string | null>(null);

  const { showError, showSuccess } = useToast();

  /**
   * デッキカードの比較関数
   * カード種別、タイプ、IDの順で比較する
   */
  const compareDeckCards = (a: DeckCard, b: DeckCard): number => {
    const cardA = a.card;
    const cardB = b.card;

    const kindComparison = kindSort({ kind: cardA.kind }, { kind: cardB.kind });
    if (kindComparison !== 0) return kindComparison;

    const typeComparison = typeSort({ type: cardA.type }, { type: cardB.type });
    if (typeComparison !== 0) return typeComparison;

    return naturalSort(cardA.id, cardB.id);
  };

  /**
   * デッキコードを生成・表示
   */
  const generateAndShowDeckCode = (): void => {
    isGeneratingCode.value = true;
    error.value = null;
    try {
      // デッキカードをソートしてからエンコード
      const sortedDeck = [...deckCards.value].sort(compareDeckCards);
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
      // 最新のClipboard APIを使用
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(deckCode.value);
        showSuccess("デッキコードをコピーしました");
      } else {
        // フォールバック: document.execCommandを使用
        throw new Error("Clipboard API not supported or failed");
      }
    } catch (e) {
      logger.warn(
        "Clipboard APIが利用できないか、失敗しました。フォールバックを試行します。",
        e
      );
      try {
        const textarea = document.createElement("textarea");
        textarea.value = deckCode.value;
        // 画面外に配置してユーザーに見えないようにする
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        document.execCommand("copy");
        document.body.removeChild(textarea);
        showSuccess("デッキコードをコピーしました");
      } catch (fallbackError) {
        const errorMessage = "デッキコードのコピーに失敗しました";
        logger.error(errorMessage + ":", fallbackError);
        error.value = errorMessage;
        showError(errorMessage);
      }
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

    // デッキコードの最大長チェック
    const MAX_DECK_CODE_LENGTH = 2000; // 例として2000文字に設定
    if (trimmedCode.length > MAX_DECK_CODE_LENGTH) {
      const warningMessage = `デッキコードが長すぎます（最大${MAX_DECK_CODE_LENGTH}文字）`;
      logger.warn(warningMessage);
      error.value = warningMessage;
      showError(warningMessage);
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
      showError(warningMessage);
      return;
    }

    // 各カードIDのフォーマット検証
    // 例: "AA-1", "BA-10" のような形式を想定 (アルファベット2文字-数字1桁以上)
    const cardIdPattern = /^[A-Z]{2}-\d+$/;
    const cardIds = trimmedCode.split("/");
    for (const cardId of cardIds) {
      if (!cardIdPattern.test(cardId)) {
        const warningMessage = `無効なカードID形式が含まれています: ${cardId}`;
        logger.warn(warningMessage);
        error.value = warningMessage;
        showError(warningMessage);
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
