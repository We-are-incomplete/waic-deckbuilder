import { defineStore } from "pinia";
import { ref, computed, watch, readonly, shallowRef } from "vue";
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS } from "../constants";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
  removeDeckCardsFromLocalStorage,
  removeDeckNameFromLocalStorage,
  createDebounce,
} from "../utils";
import { createErrorHandler } from "../utils/errorHandler";
import * as DeckDomain from "../domain/deck";
import { sortDeckCards } from "../domain/sort";

export const useDeckStore = defineStore("deck", () => {
  // Vue 3.5の新機能: shallowRef for array performance optimization
  // DeckCard配列の深い監視は不要な場合が多いためshallowRefを使用
  const deckCards = shallowRef<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");

  // エラーハンドラー
  const errorHandler = computed(() => createErrorHandler());

  /**
   * Vue 3.5最適化: ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    return readonly(sortDeckCards(deckCards.value));
  });

  /**
   * Vue 3.5最適化: デッキの合計枚数
   */
  const totalDeckCards = computed(() => {
    return deckCards.value.reduce(
      (sum: number, item: DeckCard) => sum + item.count,
      0
    );
  });

  /**
   * Vue 3.5最適化: デッキの状態情報
   */
  const deckState = computed(() => {
    return DeckDomain.calculateDeckState(deckCards.value);
  });

  /**
   * Vue 3.5最適化: デッキのエラーメッセージ
   */
  const deckErrors = computed(() => {
    return deckState.value.type === "invalid" ? deckState.value.errors : [];
  });

  /**
   * Vue 3.5最適化: 効率的な配列更新ヘルパー
   */
  const updateDeckCards = (newCards: DeckCard[]): void => {
    deckCards.value = newCards;
  };

  /**
   * Vue 3.5最適化: カードをデッキに追加
   */
  const addCardToDeck = (card: Card): void => {
    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === card.id
    );

    if (existingCardIndex > -1) {
      if (
        deckCards.value[existingCardIndex].count >=
        GAME_CONSTANTS.MAX_CARD_COPIES
      ) {
        errorHandler.value.handleValidationError(
          `カード「${card.name}」は既に最大枚数です`
        );
        return;
      }

      // 配列を新しいものに置き換える
      const newDeckCards = [...deckCards.value];
      newDeckCards[existingCardIndex] = {
        ...newDeckCards[existingCardIndex],
        count: newDeckCards[existingCardIndex].count + 1,
      };
      updateDeckCards(newDeckCards);
      return;
    }

    updateDeckCards([...deckCards.value, { card: card, count: 1 }]);
  };

  /**
   * Vue 3.5最適化: カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): void => {
    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === cardId
    );

    if (existingCardIndex === -1) {
      return;
    }

    const item = deckCards.value[existingCardIndex];
    if (item.count >= GAME_CONSTANTS.MAX_CARD_COPIES) {
      errorHandler.value.handleValidationError(
        "カード枚数が上限に達しています"
      );
      return;
    }

    const newDeckCards = [...deckCards.value];
    newDeckCards[existingCardIndex] = {
      ...item,
      count: item.count + 1,
    };
    updateDeckCards(newDeckCards);
  };

  /**
   * Vue 3.5最適化: カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): void => {
    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === cardId
    );

    if (existingCardIndex === -1) {
      return;
    }

    const item = deckCards.value[existingCardIndex];
    if (item.count === 1) {
      removeCardFromDeck(cardId);
      return;
    }

    const newDeckCards = [...deckCards.value];
    newDeckCards[existingCardIndex] = {
      ...item,
      count: item.count - 1,
    };
    updateDeckCards(newDeckCards);
  };

  /**
   * Vue 3.5最適化: カードをデッキから削除
   */
  const removeCardFromDeck = (cardId: string): void => {
    const filteredCards = deckCards.value.filter(
      (item: DeckCard) => item.card.id !== cardId
    );
    updateDeckCards(filteredCards);
  };

  /**
   * Vue 3.5最適化: ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    const loadDeckResult = loadDeckFromLocalStorage(availableCards);
    if (loadDeckResult.isErr()) {
      updateDeckCards([]);
      errorHandler.value.handleRuntimeError(
        "デッキの読み込みに失敗しました",
        loadDeckResult.error
      );
    } else {
      updateDeckCards(loadDeckResult.value);
    }

    const loadNameResult = loadDeckName();
    if (loadNameResult.isErr()) {
      deckName.value = "新しいデッキ";
      errorHandler.value.handleRuntimeError(
        "デッキ名の読み込みに失敗しました",
        loadNameResult.error
      );
    } else {
      deckName.value = loadNameResult.value;
    }
  };

  /**
   * Vue 3.5最適化: デッキカードを設定
   */
  const setDeckCards = (cards: DeckCard[]) => {
    updateDeckCards(cards);
  };

  /**
   * Vue 3.5最適化: デッキカードをリセット
   */
  const resetDeckCards = () => {
    updateDeckCards([]);
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
    deckName.value = name;
  };

  // Vue 3.5の新機能: より効率的なデバウンス処理
  const debouncedSaveResult = createDebounce((cards: DeckCard[]) => {
    saveDeckToLocalStorage(cards);
  }, 500);

  const debouncedSaveNameResult = createDebounce((name: string) => {
    saveDeckName(name);
  }, 500);

  // デバウンス関数を抽出
  const debouncedSave = debouncedSaveResult.isOk()
    ? debouncedSaveResult.value.debouncedFunc
    : (cards: DeckCard[]) => saveDeckToLocalStorage(cards);

  const debouncedSaveName = debouncedSaveNameResult.isOk()
    ? debouncedSaveNameResult.value.debouncedFunc
    : (name: string) => saveDeckName(name);

  // Vue 3.5最適化: watchEffect for better side effect management
  watch(
    deckCards,
    (newCards) => {
      debouncedSave(newCards);
    },
    { deep: false } // shallowRefなので浅い監視で十分
  );

  watch(deckName, (newName) => {
    debouncedSaveName(newName);
  });

  return {
    // State
    deckCards: readonly(deckCards),
    deckName: readonly(deckName),

    // Computed
    sortedDeckCards,
    totalDeckCards,
    deckState,
    deckErrors,

    // Actions
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    initializeDeck,
    setDeckCards,
    resetDeckCards,
    resetDeckName,
    setDeckName,
  };
});
