import { defineStore } from "pinia";
import { ref, computed, watch, readonly } from "vue";
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS } from "../constants";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
  removeDeckCardsFromLocalStorage,
  removeDeckNameFromLocalStorage,
  createNaturalSort,
  createDebounce,
} from "../utils";
import {
  createErrorHandler,
  type ShowToastFunction,
} from "../utils/errorHandler";
import * as DeckDomain from "../domain/deck";

export const useDeckStore = defineStore("deck", () => {
  const deckCards = ref<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");

  // エラーハンドラー（トースト関数は後でセットアップ時に設定）
  let showToast: ShowToastFunction | undefined;
  const errorHandler = computed(() => createErrorHandler(showToast));

  // ソート関数インスタンス
  const naturalSort = createNaturalSort();

  /**
   * デッキカードの比較関数（レガシー型対応）
   */
  const compareDeckCards = (a: DeckCard, b: DeckCard): number => {
    // 種別で比較（レガシー型の場合は文字列）
    const kindA =
      typeof a.card.kind === "string" ? a.card.kind : String(a.card.kind);
    const kindB =
      typeof b.card.kind === "string" ? b.card.kind : String(b.card.kind);
    const kindComparison = kindA.localeCompare(kindB);
    if (kindComparison !== 0) return kindComparison;

    // タイプで比較（レガシー型の場合は文字列）
    const getFirstType = (type: any): string => {
      if (typeof type === "string") return type;
      if (Array.isArray(type)) return String(type[0]);
      return String(type);
    };

    const typeA = getFirstType(a.card.type);
    const typeB = getFirstType(b.card.type);
    const typeComparison = typeA.localeCompare(typeB);
    if (typeComparison !== 0) return typeComparison;

    // IDで比較
    return naturalSort(a.card.id, b.card.id);
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
   * デッキの状態情報
   */
  const deckState = computed(() => {
    // 新しい型システムのDeckCardに変換
    const newDeckCards = deckCards.value.map((deckCard) => ({
      card: deckCard.card,
      count: deckCard.count,
    }));
    return DeckDomain.calculateDeckState(newDeckCards);
  });

  /**
   * デッキが有効かどうか（簡易版）
   */
  const isDeckValid = computed(() => {
    return (
      totalDeckCards.value <= 60 && // 仮の上限
      deckCards.value.every(
        (item) => item.count <= GAME_CONSTANTS.MAX_CARD_COPIES
      )
    );
  });

  /**
   * デッキのエラーメッセージ
   */
  const deckErrors = computed(() => {
    return deckState.value.type === "invalid" ? deckState.value.errors : [];
  });

  /**
   * カードをデッキに追加（従来版）
   */
  const addCardToDeck = (card: Card): void => {
    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === card.id
    );

    if (existingCardIndex > -1) {
      if (
        deckCards.value[existingCardIndex].count <
        GAME_CONSTANTS.MAX_CARD_COPIES
      ) {
        // 配列を新しいものに置き換える
        const newDeckCards = [...deckCards.value];
        newDeckCards[existingCardIndex] = {
          ...newDeckCards[existingCardIndex],
          count: newDeckCards[existingCardIndex].count + 1,
        };
        deckCards.value = newDeckCards;
      } else {
        errorHandler.value.handleValidationError(
          `カード「${card.name}」は既に最大枚数です`
        );
      }
    } else {
      deckCards.value = [...deckCards.value, { card: card, count: 1 }];
    }
  };

  /**
   * カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): void => {
    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === cardId
    );

    if (existingCardIndex > -1) {
      const item = deckCards.value[existingCardIndex];
      if (item.count < GAME_CONSTANTS.MAX_CARD_COPIES) {
        const newDeckCards = [...deckCards.value];
        newDeckCards[existingCardIndex] = {
          ...item,
          count: item.count + 1,
        };
        deckCards.value = newDeckCards;
      } else {
        errorHandler.value.handleValidationError(
          "カード枚数が上限に達しています"
        );
      }
    }
  };

  /**
   * カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): void => {
    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === cardId
    );

    if (existingCardIndex > -1) {
      const item = deckCards.value[existingCardIndex];
      if (item.count > 1) {
        const newDeckCards = [...deckCards.value];
        newDeckCards[existingCardIndex] = {
          ...item,
          count: item.count - 1,
        };
        deckCards.value = newDeckCards;
      } else if (item.count === 1) {
        removeCardFromDeck(cardId);
      }
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
   * ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    const loadDeckResult = loadDeckFromLocalStorage(availableCards);
    if (loadDeckResult.isOk()) {
      deckCards.value = loadDeckResult.value;
    } else {
      deckCards.value = [];
      errorHandler.value.handleRuntimeError(
        "デッキの読み込みに失敗しました",
        loadDeckResult.error
      );
    }

    const loadNameResult = loadDeckName();
    if (loadNameResult.isOk()) {
      deckName.value = loadNameResult.value;
    } else {
      deckName.value = "新しいデッキ";
      errorHandler.value.handleRuntimeError(
        "デッキ名の読み込みに失敗しました",
        loadNameResult.error
      );
    }
  };

  /**
   * デッキカードを設定
   */
  const setDeckCards = (cards: DeckCard[]) => {
    deckCards.value = cards;
  };

  /**
   * デッキカードをリセット
   */
  const resetDeckCards = () => {
    deckCards.value = [];
    removeDeckCardsFromLocalStorage();
  };

  /**
   * デッキ名をリセット
   */
  const resetDeckName = () => {
    deckName.value = "新しいデッキ";
    removeDeckNameFromLocalStorage();
  };

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    if (!name || name.trim().length === 0) {
      errorHandler.value.handleValidationError("デッキ名を入力してください");
      return;
    }
    deckName.value = name.trim();
  };

  /**
   * トースト表示関数を設定
   */
  const setToastFunction = (toastFunc: ShowToastFunction): void => {
    showToast = toastFunc;
  };

  // デッキ変更時のローカルストレージ保存（デバウンス）
  const debounceResult = createDebounce(
    (newDeck: DeckCard[]) => saveDeckToLocalStorage(newDeck),
    300
  );

  if (debounceResult.isErr()) {
    throw new Error("debounce作成に失敗しました");
  }

  const { debouncedFunc: debouncedSaveDeck } = debounceResult.value;

  watch(deckCards, debouncedSaveDeck, { deep: true });

  // デッキ名変更時のローカルストレージ保存（デバウンス）
  const debounceNameResult = createDebounce(
    (newName: string) => saveDeckName(newName),
    300
  );

  if (debounceNameResult.isErr()) {
    throw new Error("debounce作成に失敗しました");
  }

  const { debouncedFunc: debouncedSaveDeckName } = debounceNameResult.value;

  watch(deckName, debouncedSaveDeckName);

  return {
    // リアクティブな状態
    deckCards,
    deckName,
    sortedDeckCards,
    totalDeckCards,
    deckState,
    isDeckValid,
    deckErrors,

    // アクション
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    initializeDeck,
    setDeckName,
    setDeckCards,
    resetDeckCards,
    resetDeckName,
    setToastFunction,
  };
});
