/**
 * デッキ操作に関するComposable
 * デッキへのカード追加、削除、検索、統計計算などの機能を提供
 * エラーハンドリングを含む
 */
import { computed, type ComputedRef } from "vue";
import type { Card, DeckCard, DeckOperation } from "../types";
import * as DeckDomain from "../domain";
import { useCardsStore, useDeckStore } from "../stores";

type DeckOperationErrorLike = {
  type?: string;
  cardId?: string;
  maxCount?: number;
  count?: number;
};
const isDeckOperationError = (e: unknown): e is DeckOperationErrorLike =>
  !!e && typeof e === "object" && "type" in (e as any);

const formatDeckOperationError = (err: DeckOperationErrorLike): string => {
  switch (err.type) {
    case "CardNotFound":
      return `カードが見つかりません: ${err.cardId}`;
    case "MaxCountExceeded":
      return `最大枚数を超過しました: ${err.cardId} (最大: ${err.maxCount ?? "不明"})`;
    case "InvalidCardCount":
      return `不正なカード枚数です: ${err.cardId} (指定: ${err.count ?? "不明"})`;
    default:
      return "不明なエラー";
  }
};

export const useDeckOperations = () => {
  const deckStore = useDeckStore();
  const cardsStore = useCardsStore();

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
          validationErrors: state.errors.map(formatDeckOperationError),
        };
    }
  });

  /**
   * カードをデッキに安全に追加（最適化版）
   */
  const addCardToDeck = (card: Card): boolean =>
    executeDeckOperationSafely(
      { type: "addCard", card },
      "カードの追加に失敗しました",
    );

  /**
   * デッキ操作を安全に実行する共通ヘルパー関数
   * 成功時はストアを更新してtrue、失敗時はエラーハンドリングしてfalseを返す
   */
  const executeDeckOperationSafely = <T extends DeckOperation>(
    operation: T,
    errorMessage: string,
  ): boolean => {
    try {
      const result = DeckDomain.executeDeckOperation(
        deckStore.deckCards,
        operation,
      );
      deckStore.setDeckCards([...result]);
      return true;
    } catch (error) {
      const err = isDeckOperationError(error) ? error : ({} as any);
      const msg = formatDeckOperationError(err);
      console.error(`${errorMessage}: ${msg}`, error);
      return false;
    }
  };

  /**
   * カード枚数を安全に増加（最適化版）
   */
  const incrementCardCount = (cardId: string): boolean =>
    executeDeckOperationSafely(
      { type: "incrementCount", cardId },
      "カード枚数の増加に失敗しました",
    );

  /**
   * カード枚数を安全に減少（最適化版）
   */
  const decrementCardCount = (cardId: string): boolean =>
    executeDeckOperationSafely(
      { type: "decrementCount", cardId },
      "カード枚数の減少に失敗しました",
    );

  /**
   * カードをデッキから安全に削除（最適化版）
   */
  const removeCardFromDeck = (cardId: string): boolean =>
    executeDeckOperationSafely(
      { type: "removeCard", cardId },
      "カードの削除に失敗しました",
    );

  /**
   * デッキを安全にクリア（最適化版）
   */
  const clearDeck = (): boolean =>
    executeDeckOperationSafely(
      { type: "clear" },
      "デッキのクリアに失敗しました",
    );

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
    const deckCards = deckStore.sortedDeckCards;
    if (!searchText || searchText.trim().length === 0) return deckCards;
    const normalized = searchText.trim().toLowerCase();
    return deckCards.filter((dc) => {
      const name = dc.card.name.toLowerCase();
      const id = dc.card.id.toLowerCase();
      return name.includes(normalized) || id.includes(normalized);
    });
  };

  /**
   * デッキ統計を取得（最適化版）
   */
  const getDeckStatistics = () => {
    const deckCards = deckStore.sortedDeckCards;
    const kindStats = new Map<string, number>();
    const typeStats = new Map<string, number>();
    let totalCards = 0;

    for (const deckCard of deckCards) {
      const { card, count } = deckCard;
      totalCards += count;
      kindStats.set(card.kind, (kindStats.get(card.kind) || 0) + count);
      const typeString = card.type.join(",");
      typeStats.set(typeString, (typeStats.get(typeString) || 0) + count);
    }

    return {
      totalCards,
      uniqueCards: deckCards.length,
      kindStats: Object.fromEntries(kindStats),
      typeStats: Object.fromEntries(typeStats),
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
