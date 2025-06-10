import { computed, type ComputedRef } from "vue";
import type { Card, DeckCard, CardType } from "../types";
import * as DeckDomain from "../domain/deck";
import { useDeckStore } from "../stores/deck";
import { useCardsStore } from "../stores/cards";
import type { ShowToastFunction } from "../utils/errorHandler";

// エラーハンドリング用
interface ErrorHandler {
  handleValidationError: (message: string) => void;
}

// CardTypeから文字列表現を取得するヘルパー関数
const getSingleTypeString = (cardType: CardType): string => {
  switch (cardType.type) {
    case "color":
      return cardType.value;
    case "timing":
      return cardType.value;
    case "equipment":
      return cardType.value;
    case "installation":
      return cardType.value;
  }
};

export const useDeckOperations = (showToast?: ShowToastFunction) => {
  const deckStore = useDeckStore();
  const cardsStore = useCardsStore();

  // エラーハンドリング設定
  const errorHandler: ErrorHandler = {
    handleValidationError: (message: string) => {
      showToast?.(message);
    },
  };

  /**
   * デッキ状態を計算
   */
  const deckState: ComputedRef<{
    totalCount: number;
    isValid: boolean;
    validationErrors: readonly string[];
  }> = computed(() => {
    const state = DeckDomain.calculateDeckState(deckStore.deckCards);

    switch (state.type) {
      case "empty":
        return {
          totalCount: 0,
          isValid: true,
          validationErrors: [],
        };
      case "valid":
        return {
          totalCount: state.totalCount,
          isValid: true,
          validationErrors: [],
        };
      case "invalid":
        return {
          totalCount: state.totalCount,
          isValid: false,
          validationErrors: state.errors,
        };
    }
  });

  /**
   * カードをデッキに安全に追加
   */
  const addCardToDeck = (card: Card): boolean => {
    const result = DeckDomain.executeDeckOperation(deckStore.deckCards, {
      type: "addCard",
      card: card,
    });

    if (result.isOk()) {
      deckStore.setDeckCards([...result.value]);
      return true;
    }

    switch (result.error.type) {
      case "maxCountExceeded":
        errorHandler.handleValidationError(
          `カード「${card.name}」は既に最大枚数です`
        );
        break;
      case "deckSizeExceeded":
        errorHandler.handleValidationError("デッキサイズの上限を超えます");
        break;
      default:
        errorHandler.handleValidationError("カードの追加に失敗しました");
    }
    return false;
  };

  /**
   * カード枚数を安全に増加
   */
  const incrementCardCount = (cardId: string): boolean => {
    const result = DeckDomain.executeDeckOperation(deckStore.deckCards, {
      type: "incrementCount",
      cardId,
    });

    if (result.isOk()) {
      deckStore.setDeckCards([...result.value]);
      return true;
    }

    errorHandler.handleValidationError("カード枚数の増加に失敗しました");
    return false;
  };

  /**
   * カード枚数を安全に減少
   */
  const decrementCardCount = (cardId: string): boolean => {
    const result = DeckDomain.executeDeckOperation(deckStore.deckCards, {
      type: "decrementCount",
      cardId,
    });

    if (result.isOk()) {
      deckStore.setDeckCards([...result.value]);
      return true;
    }

    errorHandler.handleValidationError("カード枚数の減少に失敗しました");
    return false;
  };

  /**
   * カードをデッキから安全に削除
   */
  const removeCardFromDeck = (cardId: string): boolean => {
    const result = DeckDomain.executeDeckOperation(deckStore.deckCards, {
      type: "removeCard",
      cardId,
    });

    if (result.isOk()) {
      deckStore.setDeckCards([...result.value]);
      return true;
    }

    errorHandler.handleValidationError("カードの削除に失敗しました");
    return false;
  };

  /**
   * デッキを安全にクリア
   */
  const clearDeck = (): boolean => {
    const result = DeckDomain.executeDeckOperation(deckStore.deckCards, {
      type: "clear",
    });

    if (result.isOk()) {
      deckStore.setDeckCards([...result.value]);
      return true;
    }

    errorHandler.handleValidationError("デッキのクリアに失敗しました");
    return false;
  };

  /**
   * カードIDから詳細情報を取得
   */
  const getCardDetails = (cardId: string): Card | undefined => {
    return cardsStore.getCardById(cardId);
  };

  /**
   * デッキ内のカードを検索
   */
  const searchDeckCards = (searchText: string): readonly DeckCard[] => {
    if (!searchText || searchText.trim().length === 0) {
      return deckStore.sortedDeckCards;
    }

    return deckStore.sortedDeckCards.filter((deckCard) => {
      const normalizedSearchText = searchText.trim().toLowerCase();
      return (
        deckCard.card.name.toLowerCase().includes(normalizedSearchText) ||
        deckCard.card.id.toLowerCase().includes(normalizedSearchText)
      );
    });
  };

  /**
   * デッキ統計を取得
   */
  const getDeckStatistics = () => {
    const cards = deckStore.sortedDeckCards;
    const kindStats = new Map<string, number>();
    const typeStats = new Map<string, number>();
    let totalCost = 0;

    for (const deckCard of cards) {
      const { card, count } = deckCard;

      // 種別統計
      const kindString =
        typeof card.kind === "string" ? card.kind : card.kind.type;
      kindStats.set(kindString, (kindStats.get(kindString) || 0) + count);

      // タイプ統計
      const typeString = Array.isArray(card.type)
        ? card.type.map((t) => getSingleTypeString(t)).join(", ")
        : getSingleTypeString(card.type as CardType);
      typeStats.set(typeString, (typeStats.get(typeString) || 0) + count);
    }

    return {
      totalCards: DeckDomain.calculateTotalCards(cards),
      uniqueCards: cards.length,
      kindStats: Object.fromEntries(kindStats),
      typeStats: Object.fromEntries(typeStats),
      totalCost,
    };
  };

  return {
    // 計算プロパティ
    deckState,

    // デッキ操作
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    clearDeck,

    // ユーティリティ
    getCardDetails,
    searchDeckCards,
    getDeckStatistics,
  };
};
