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
  createDebounce,
} from "../utils";
import { createErrorHandler } from "../utils/errorHandler";
import * as DeckDomain from "../domain/deck";
import { sortDeckCards } from "../domain/sort";

export const useDeckStore = defineStore("deck", () => {
  const deckCards = ref<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");

  // エラーハンドラー
  const errorHandler = computed(() => createErrorHandler());

  /**
   * ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    return readonly(sortDeckCards(deckCards.value));
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
   * デッキのエラーメッセージ
   */
  const deckErrors = computed(() => {
    return deckState.value.type === "invalid" ? deckState.value.errors : [];
  });

  /**
   * カードをデッキに追加
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
      deckCards.value = newDeckCards;
      return;
    }

    deckCards.value = [...deckCards.value, { card: card, count: 1 }];
  };

  /**
   * カード枚数を増やす
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
    deckCards.value = newDeckCards;
  };

  /**
   * カード枚数を減らす
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
    deckCards.value = newDeckCards;
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
    if (loadDeckResult.isErr()) {
      deckCards.value = [];
      errorHandler.value.handleRuntimeError(
        "デッキの読み込みに失敗しました",
        loadDeckResult.error
      );
    } else {
      deckCards.value = loadDeckResult.value;
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

  // デッキ変更時のローカルストレージ保存（デバウンス）
  const debounceResult = createDebounce(
    (newDeck: DeckCard[]) => saveDeckToLocalStorage(newDeck),
    300
  );

  if (debounceResult.isErr()) {
    errorHandler.value.handleRuntimeError(
      "デッキ保存用のdebounce作成に失敗しました",
      debounceResult.error
    );
    // フォールバック: デバウンスなしで直接保存
    watch(deckCards, (newDeck) => saveDeckToLocalStorage(newDeck), {
      deep: true,
    });
  } else {
    const { debouncedFunc: debouncedSaveDeck } = debounceResult.value;
    watch(deckCards, debouncedSaveDeck, { deep: true });
  }

  // デッキ名変更時のローカルストレージ保存（デバウンス）
  const debounceNameResult = createDebounce(
    (newName: string) => saveDeckName(newName),
    300
  );

  if (debounceNameResult.isErr()) {
    errorHandler.value.handleRuntimeError(
      "デッキ名保存用のdebounce作成に失敗しました",
      debounceNameResult.error
    );
    // フォールバック: デバウンスなしで直接保存
    watch(deckName, (newName) => saveDeckName(newName));
  } else {
    const { debouncedFunc: debouncedSaveDeckName } = debounceNameResult.value;
    watch(deckName, debouncedSaveDeckName);
  }

  return {
    // リアクティブな状態
    deckCards,
    deckName,
    sortedDeckCards,
    totalDeckCards,
    deckState,
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
  };
});
