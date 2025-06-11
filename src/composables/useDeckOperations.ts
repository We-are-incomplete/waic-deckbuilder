import { computed, type ComputedRef } from "vue";
import type { Card, DeckCard, CardType } from "../types";
import * as DeckDomain from "../domain/deck";
import { useDeckStore } from "../stores/deck";
import { useCardsStore } from "../stores/cards";
import {
  memoizeArrayComputation,
  memoizeObjectComputation,
} from "../utils/memoization";
import type { ErrorHandler } from "../utils/errorHandler";

// CardTypeから文字列表現を取得するヘルパー関数（最適化版）
const getSingleTypeString = (cardType: CardType): string => {
  return cardType.value;
};

export const useDeckOperations = () => {
  const deckStore = useDeckStore();
  const cardsStore = useCardsStore();

  // エラーハンドリング設定
  const errorHandler: ErrorHandler = {
    handleValidationError: (message: string) => {
      console.warn(message);
    },
  };

  // メモ化された統計計算（配列版を使用）
  const memoizedStatsCalculation = memoizeArrayComputation(
    (deckCards: readonly DeckCard[]) => {
      const kindStats = new Map<string, number>();
      const typeStats = new Map<string, number>();
      let totalCost = 0;
      let totalCards = 0;

      for (const deckCard of deckCards) {
        const { card, count } = deckCard;
        totalCards += count;

        // 種別統計（効率化）
        const kindString =
          typeof card.kind === "string" ? card.kind : card.kind.type;
        kindStats.set(kindString, (kindStats.get(kindString) || 0) + count);

        // タイプ統計（効率化）
        const typeString = Array.isArray(card.type)
          ? card.type.map((t) => t.value).join(", ")
          : (card.type as CardType).value;
        typeStats.set(typeString, (typeStats.get(typeString) || 0) + count);
      }

      return {
        totalCards,
        uniqueCards: deckCards.length,
        kindStats: Object.fromEntries(kindStats),
        typeStats: Object.fromEntries(typeStats),
        totalCost,
      };
    },
    { maxSize: 20, ttl: 2 * 60 * 1000 } // 2分間キャッシュ
  );

  // メモ化された検索機能
  const memoizedDeckSearch = memoizeObjectComputation(
    (params: { deckCards: readonly DeckCard[]; searchText: string }) => {
      const { deckCards, searchText } = params;

      if (!searchText || searchText.trim().length === 0) {
        return deckCards;
      }

      const normalizedSearchText = searchText.trim().toLowerCase();
      const result: DeckCard[] = [];

      for (const deckCard of deckCards) {
        const cardName = deckCard.card.name.toLowerCase();
        const cardId = deckCard.card.id.toLowerCase();

        if (
          cardName.includes(normalizedSearchText) ||
          cardId.includes(normalizedSearchText)
        ) {
          result.push(deckCard);
        }
      }

      return result;
    },
    { maxSize: 30, ttl: 1 * 60 * 1000 } // 1分間キャッシュ
  );

  /**
   * デッキ状態を計算（最適化版）
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
   * カードをデッキに安全に追加（最適化版）
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
   * カード枚数を安全に増加（最適化版）
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
   * カード枚数を安全に減少（最適化版）
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
   * カードをデッキから安全に削除（最適化版）
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
   * デッキを安全にクリア（最適化版）
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
   * カードIDから詳細情報を取得（最適化版）
   */
  const getCardDetails = (cardId: string): Card | undefined => {
    return cardsStore.getCardById(cardId);
  };

  /**
   * デッキ内のカードを検索（最適化版）
   */
  const searchDeckCards = (searchText: string): readonly DeckCard[] => {
    if (memoizedDeckSearch.isOk()) {
      return memoizedDeckSearch.value({
        deckCards: deckStore.sortedDeckCards,
        searchText,
      });
    }

    // フォールバック
    if (!searchText || searchText.trim().length === 0) {
      return deckStore.sortedDeckCards;
    }

    const normalizedSearchText = searchText.trim().toLowerCase();
    return deckStore.sortedDeckCards.filter(
      (deckCard) =>
        deckCard.card.name.toLowerCase().includes(normalizedSearchText) ||
        deckCard.card.id.toLowerCase().includes(normalizedSearchText)
    );
  };

  /**
   * デッキ統計を取得（最適化版）
   */
  const getDeckStatistics = () => {
    const deckCards = deckStore.sortedDeckCards;

    if (memoizedStatsCalculation.isOk()) {
      return memoizedStatsCalculation.value(deckCards);
    }

    // フォールバック
    const kindStats = new Map<string, number>();
    const typeStats = new Map<string, number>();
    let totalCost = 0;

    for (const deckCard of deckCards) {
      const { card, count } = deckCard;

      // 種別統計
      const kindString =
        typeof card.kind === "string" ? card.kind : card.kind.type;
      kindStats.set(kindString, (kindStats.get(kindString) || 0) + count);

      // タイプ統計
      const typeString = Array.isArray(card.type)
        ? card.type.map(getSingleTypeString).join(", ")
        : getSingleTypeString(card.type as CardType);
      typeStats.set(typeString, (typeStats.get(typeString) || 0) + count);
    }

    let totalCards = 0; // フォールバック時にも計算
    for (const deckCard of deckCards) {
      totalCards += deckCard.count;
    }

    return {
      totalCards,
      uniqueCards: deckCards.length,
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
