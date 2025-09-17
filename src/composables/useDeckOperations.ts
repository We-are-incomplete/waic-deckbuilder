/**
 * デッキ操作に関するComposable
 * デッキへのカード追加、削除、検索、統計計算などの機能を提供
 * メモ化による最適化とエラーハンドリングを含む
 */
import { computed, type ComputedRef } from "vue";
import type { Card, DeckCard, DeckOperation } from "../types";
import * as DeckDomain from "../domain";
import { useCardsStore, useDeckStore } from "../stores";
import { useMemoize } from "@vueuse/core";
import { createErrorHandler, deckOperationErrorToString } from "../utils";
import { Effect } from "effect";

/**
 * 安全なハッシュ関数（64bitバージョン）
 * 32bitハッシュの衝突リスクを大幅に削減
 * 2つの異なる32bitハッシュを組み合わせて64bitハッシュを生成
 * 約1.8 × 10^19通り（2^64）のパターンで衝突リスクを大幅に軽減
 */
const createSafeHash = (input: string): string => {
  let hashA = 5381;
  let hashB = 52711;

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hashA = (hashA * 33) ^ char;
    hashB = (hashB * 37) ^ char;
  }

  // 64bitハッシュとして結合（32bit × 2）
  // 16文字の16進文字列 = 約1.8 × 10^19通り
  const hashAStr = (hashA >>> 0).toString(16).padStart(8, "0");
  const hashBStr = (hashB >>> 0).toString(16).padStart(8, "0");
  return hashAStr + hashBStr;
};

export const useDeckOperations = () => {
  const deckStore = useDeckStore();
  const cardsStore = useCardsStore();

  // エラーハンドリング設定
  const errorHandler = createErrorHandler();

  // メモ化された統計計算（安全なキー版）
  const baseMemoizedStatsCalculation = useMemoize(
    (_deckHash: string, deckCards: readonly DeckCard[]) => {
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
    },
    {
      // 安全なキー関数: 64bitハッシュで衝突リスクを大幅に削減
      getKey: (deckHash: string) => createSafeHash(deckHash),
    },
  );

  // メモ化された検索機能（安全なキー版）
  const baseMemoizedDeckSearch = useMemoize(
    (
      _searchKey: string,
      deckCards: readonly DeckCard[],
      searchText: string,
    ) => {
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
    {
      // 安全なキー関数: 64bitハッシュで衝突リスクを大幅に削減
      getKey: (searchKey: string) => createSafeHash(searchKey),
    },
  );

  // 統一ラッパーでラップしたメモ化関数
  const memoizedStatsCalculation = baseMemoizedStatsCalculation;

  const memoizedDeckSearch = baseMemoizedDeckSearch;

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
          validationErrors: state.errors.map(deckOperationErrorToString),
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
    const resultEffect = DeckDomain.executeDeckOperation(
      deckStore.deckCards,
      operation,
    );

    const result = Effect.runSync(Effect.either(resultEffect));

    if (result._tag === "Right") {
      deckStore.setDeckCards([...result.right]);
      return true;
    }

    errorHandler.handleValidationError(
      `${errorMessage}: ${result.left._tag}`,
      result.left,
    );
    return false;
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
    // ストアから提供される軽量ハッシュを使用
    const deckHash = deckStore.deckHash;
    const searchKey = `${deckHash}|${searchText.trim().toLowerCase()}`;

    return memoizedDeckSearch(searchKey, deckStore.sortedDeckCards, searchText);
  };

  /**
   * デッキ統計を取得（最適化版）
   */
  const getDeckStatistics = () => {
    // ストアから提供される軽量ハッシュを使用
    const deckHash = deckStore.deckHash;

    return memoizedStatsCalculation(deckHash, deckStore.sortedDeckCards);
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
