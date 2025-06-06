import { ref, computed, watch, readonly } from "vue";
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS, STORAGE_KEYS } from "../constants";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
} from "../utils/storage";
import { encodeDeckCode, decodeDeckCode } from "../utils/deckCode";
import {
  createNaturalSort,
  createKindSort,
  createTypeSort,
} from "../utils/sort";
import { logger } from "../utils/logger";
import { useToast } from "./useToast";

export function useDeck() {
  const deckCards = ref<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");
  const deckCode = ref<string>("");
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);
  const showResetConfirmModal = ref<boolean>(false);
  const error = ref<string | null>(null);

  // トースト通知システムを初期化
  const { showError, showSuccess } = useToast();

  // ソート関数インスタンス
  const naturalSort = createNaturalSort();
  const kindSort = createKindSort();
  const typeSort = createTypeSort();

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
   * ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    const sorted = [...deckCards.value];
    sorted.sort(compareDeckCards);
    return readonly(sorted);
  });

  /**
   * デッキの合計枚数
   */
  const totalDeckCards = computed(() => {
    return deckCards.value.reduce(
      (sum: number, item: DeckCard) => sum + item.count,
      0
    );
  });

  /**
   * カードをデッキに追加
   */
  const addCardToDeck = (card: Card): void => {
    if (totalDeckCards.value >= GAME_CONSTANTS.MAX_DECK_SIZE) {
      return;
    }

    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === card.id
    );

    if (existingCardIndex > -1) {
      if (
        deckCards.value[existingCardIndex].count <
        GAME_CONSTANTS.MAX_CARD_COPIES
      ) {
        deckCards.value[existingCardIndex].count++;
      }
    } else {
      deckCards.value.push({ card: card, count: 1 });
    }
  };

  /**
   * カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): void => {
    if (totalDeckCards.value >= GAME_CONSTANTS.MAX_DECK_SIZE) {
      return;
    }
    const item = deckCards.value.find(
      (item: DeckCard) => item.card.id === cardId
    );
    if (item && item.count < GAME_CONSTANTS.MAX_CARD_COPIES) {
      item.count++;
    }
  };

  /**
   * カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): void => {
    const item = deckCards.value.find(
      (item: DeckCard) => item.card.id === cardId
    );
    if (item && item.count > 1) {
      item.count--;
    } else if (item && item.count === 1) {
      removeCardFromDeck(cardId);
    }
  };

  /**
   * カードをデッキから削除
   */
  const removeCardFromDeck = (cardId: string): void => {
    deckCards.value = deckCards.value.filter(
      (item: DeckCard) => item.card.id !== cardId
    );
  };

  /**
   * デッキをリセット（確認ダイアログを表示）
   */
  const resetDeck = (): void => {
    showResetConfirmModal.value = true;
  };

  /**
   * デッキリセットの確認を受け取った場合の処理
   */
  const confirmResetDeck = (): void => {
    deckCards.value = [];
    deckName.value = "新しいデッキ";
    localStorage.removeItem(STORAGE_KEYS.DECK_CARDS);
    localStorage.removeItem(STORAGE_KEYS.DECK_NAME);
    showResetConfirmModal.value = false;
    showSuccess("デッキをリセットしました");
  };

  /**
   * デッキリセットの確認をキャンセル
   */
  const cancelResetDeck = (): void => {
    showResetConfirmModal.value = false;
  };

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
        deckCards.value.map((item) => `${item.card.id} x${item.count}`)
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
  const importDeckFromCode = (availableCards: readonly Card[]): void => {
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
        deckCards.value = importedCards;
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
   * ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    deckCards.value = loadDeckFromLocalStorage(availableCards);
    deckName.value = loadDeckName();
  };

  // デッキ変更時のローカルストレージ保存
  watch(
    deckCards,
    (newDeck: DeckCard[]) => {
      saveDeckToLocalStorage(newDeck);
    },
    { deep: true }
  );

  // デッキ名変更時のローカルストレージ保存
  watch(deckName, (newName: string) => {
    saveDeckName(newName);
  });

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    deckName.value = name;
  };

  /**
   * インポート用デッキコードを設定
   */
  const setImportDeckCode = (code: string): void => {
    importDeckCode.value = code;
  };

  return {
    deckCards,
    deckName,
    deckCode,
    importDeckCode,
    isGeneratingCode,
    showDeckCodeModal,
    showResetConfirmModal,
    error,
    sortedDeckCards,
    totalDeckCards,
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,
    generateAndShowDeckCode,
    copyDeckCode,
    importDeckFromCode,
    initializeDeck,
    setDeckName,
    setImportDeckCode,
  };
}
