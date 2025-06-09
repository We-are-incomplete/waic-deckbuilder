import { computed, type ComputedRef } from "vue";
import type { Card, DeckCard } from "../types";
import type { DeckCard as NewDeckCard } from "../types/deck";
import * as DeckDomain from "../domain/deck";
import { useDeckStore } from "../stores/deck";
import { useCardsStore } from "../stores/cards";
import type { ShowToastFunction } from "../utils/errorHandler";

// エラーハンドリング用
interface ErrorHandler {
  handleValidationError: (message: string) => void;
}

// CardTypeから文字列表現を取得するヘルパー関数
const getSingleTypeString = (cardType: any): string => {
  if (typeof cardType === "object" && cardType && "type" in cardType) {
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
  }
  return String(cardType);
};

const getTypeString = (cardType: Card["type"]): string => {
  if (Array.isArray(cardType)) {
    return cardType.map((t) => getSingleTypeString(t)).join(", ");
  }
  return getSingleTypeString(cardType);
};

/**
 * NewDeckCard配列をレガシーDeckCard配列に変換
 */
const convertToLegacyDeckCards = (
  deckCards: readonly NewDeckCard[]
): DeckCard[] => {
  return deckCards.map((deckCard) => ({
    card: deckCard.card,
    count: deckCard.count,
  }));
};

/**
 * レガシーDeckCard配列をNewDeckCard配列に変換
 */
const convertToNewDeckCards = (
  deckCards: readonly DeckCard[]
): NewDeckCard[] => {
  return deckCards.map((deckCard) => ({
    card: deckCard.card,
    count: deckCard.count,
  }));
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
    // 新しい型システムのDeckCardに変換
    const newDeckCards = convertToNewDeckCards(deckStore.deckCards);

    const state = DeckDomain.calculateDeckState(newDeckCards);

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
    // 新しい型システムのDeckCardに変換
    const newDeckCards = convertToNewDeckCards(deckStore.deckCards);

    const result = DeckDomain.executeDeckOperation(newDeckCards, {
      type: "addCard",
      card: card,
    });

    if (result.isOk()) {
      // レガシー型に戻して設定
      const legacyDeckCards = convertToLegacyDeckCards(result.value);
      deckStore.setDeckCards(legacyDeckCards);
      return true;
    } else {
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
    }
  };

  /**
   * カード枚数を安全に増加
   */
  const incrementCardCount = (cardId: string): boolean => {
    const newDeckCards = convertToNewDeckCards(deckStore.deckCards);

    const result = DeckDomain.executeDeckOperation(newDeckCards, {
      type: "incrementCount",
      cardId,
    });

    if (result.isOk()) {
      const legacyDeckCards = convertToLegacyDeckCards(result.value);
      deckStore.setDeckCards(legacyDeckCards);
      return true;
    } else {
      errorHandler.handleValidationError("カード枚数の増加に失敗しました");
      return false;
    }
  };

  /**
   * カード枚数を安全に減少
   */
  const decrementCardCount = (cardId: string): boolean => {
    const newDeckCards = convertToNewDeckCards(deckStore.deckCards);

    const result = DeckDomain.executeDeckOperation(newDeckCards, {
      type: "decrementCount",
      cardId,
    });

    if (result.isOk()) {
      const legacyDeckCards = convertToLegacyDeckCards(result.value);
      deckStore.setDeckCards(legacyDeckCards);
      return true;
    } else {
      errorHandler.handleValidationError("カード枚数の減少に失敗しました");
      return false;
    }
  };

  /**
   * カードをデッキから安全に削除
   */
  const removeCardFromDeck = (cardId: string): boolean => {
    const newDeckCards = convertToNewDeckCards(deckStore.deckCards);

    const result = DeckDomain.executeDeckOperation(newDeckCards, {
      type: "removeCard",
      cardId,
    });

    if (result.isOk()) {
      const legacyDeckCards = convertToLegacyDeckCards(result.value);
      deckStore.setDeckCards(legacyDeckCards);
      return true;
    } else {
      errorHandler.handleValidationError("カードの削除に失敗しました");
      return false;
    }
  };

  /**
   * デッキを安全にクリア
   */
  const clearDeck = (): boolean => {
    const newDeckCards = convertToNewDeckCards(deckStore.deckCards);

    const result = DeckDomain.executeDeckOperation(newDeckCards, {
      type: "clear",
    });

    if (result.isOk()) {
      const legacyDeckCards = convertToLegacyDeckCards(result.value);
      deckStore.setDeckCards(legacyDeckCards);
      return true;
    } else {
      errorHandler.handleValidationError("デッキのクリアに失敗しました");
      return false;
    }
  };

  /**
   * カードIDから詳細情報を取得
   */
  const getCardDetails = (cardId: string): Card | undefined => {
    return cardsStore.getCardById(cardId);
  };

  /**
   * デッキ内のカード検索
   */
  const searchDeckCards = (searchText: string): readonly DeckCard[] => {
    if (!searchText.trim()) {
      return deckStore.sortedDeckCards;
    }

    return deckStore.sortedDeckCards.filter((deckCard) => {
      const card = deckCard.card;
      const lowerSearchText = searchText.toLowerCase();

      // カード名で検索
      if (card.name.toLowerCase().includes(lowerSearchText)) {
        return true;
      }

      // IDで検索
      if (card.id.toLowerCase().includes(lowerSearchText)) {
        return true;
      }

      // タグで検索
      if (card.tags) {
        const tags = Array.isArray(card.tags) ? card.tags : [card.tags];
        return tags.some((tag) => tag.toLowerCase().includes(lowerSearchText));
      }

      return false;
    });
  };

  /**
   * デッキ統計情報を計算
   */
  const deckStatistics = computed(() => {
    const cards = deckStore.deckCards;
    const totalCount = deckStore.totalDeckCards;

    // 種別ごとの統計
    const kindStats = new Map<string, number>();
    // タイプごとの統計
    const typeStats = new Map<string, number>();

    for (const deckCard of cards) {
      const { card, count } = deckCard;

      // 種別統計
      const kind = card.kind.type;
      kindStats.set(kind, (kindStats.get(kind) || 0) + count);

      // タイプ統計
      const typeString = getTypeString(card.type);
      typeStats.set(typeString, (typeStats.get(typeString) || 0) + count);
    }

    return {
      totalCount,
      kindStats: Object.fromEntries(kindStats),
      typeStats: Object.fromEntries(typeStats),
    };
  });

  return {
    deckState,
    deckStatistics,
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    clearDeck,
    getCardDetails,
    searchDeckCards,
  };
};
