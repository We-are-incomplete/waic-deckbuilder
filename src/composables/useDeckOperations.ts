import { computed, type ComputedRef } from "vue";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import * as DeckDomain from "../domain/deck";
import { useDeckStore } from "../stores/deck";
import { useCardsStore } from "../stores/cards";
import { useMemoize } from "@vueuse/core";
import { createErrorHandler } from "../utils/errorHandler"; // createErrorHandler を追加

/**
 * メモ化最適化: パフォーマンステスト用のカウンター
 * 実測でヒット率を確認するためのデバッグ機能
 */
let statsHitCount = 0;
let statsMissCount = 0;
let searchHitCount = 0;
let searchMissCount = 0;

export const useDeckOperations = () => {
  const deckStore = useDeckStore();
  const cardsStore = useCardsStore();

  // エラーハンドリング設定
  const errorHandler = createErrorHandler();

  // 独自のキャッシュ追跡用Map（ライブラリの内部APIに依存しない）
  const statsCache = new Map<string, boolean>();
  const searchCache = new Map<string, boolean>();

  // メモ化された統計計算（最適化版）
  const memoizedStatsCalculation = useMemoize(
    (_deckHash: string, deckCards: readonly DeckCard[]) => {
      statsMissCount++;
      console.debug(
        `Stats cache MISS. Total: Hit=${statsHitCount}, Miss=${statsMissCount}, Ratio=${(
          (statsHitCount / (statsHitCount + statsMissCount)) *
          100
        ).toFixed(1)}%`
      );

      const kindStats = new Map<string, number>();
      const typeStats = new Map<string, number>();
      let totalCards = 0;

      for (const deckCard of deckCards) {
        const { card, count } = deckCard;
        totalCards += count;
        kindStats.set(card.kind, (kindStats.get(card.kind) || 0) + count);
        const typeString = card.type;
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
      // カスタムキー関数: 軽量なハッシュのみを使用
      getKey: (deckHash: string) => deckHash,
    }
  );

  // メモ化された検索機能（最適化版）
  const memoizedDeckSearch = useMemoize(
    (
      _searchKey: string,
      deckCards: readonly DeckCard[],
      searchText: string
    ) => {
      console.debug(`Search cache MISS for key: ${_searchKey}`);

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
      // カスタムキー関数: deckHashとsearchTextを組み合わせた軽量キー
      getKey: (searchKey: string) => searchKey,
    }
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

    errorHandler.handleValidationError(
      `カード枚数の増加に失敗しました: ${result.error.type}`,
      result.error
    );
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

    errorHandler.handleValidationError(
      `カード枚数の減少に失敗しました: ${result.error.type}`,
      result.error
    );
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

    errorHandler.handleValidationError(
      `カードの削除に失敗しました: ${result.error.type}`,
      result.error
    );
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

    errorHandler.handleValidationError(
      `デッキのクリアに失敗しました: ${result.error.type}`,
      result.error
    );
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
    // ストアから提供される軽量ハッシュを使用
    const deckHash = deckStore.deckHash;
    const searchKey = `${deckHash}|${searchText.trim().toLowerCase()}`;

    // 独自のキャッシュ追跡でヒット/ミスの判定
    const isHit = searchCache.has(searchKey);
    if (isHit) {
      searchHitCount++;
      console.debug(`Search cache HIT for key: ${searchKey.slice(0, 50)}...`);
    } else {
      searchMissCount++;
      console.debug(`Search cache MISS for key: ${searchKey.slice(0, 50)}...`);
    }

    const result = memoizedDeckSearch(
      searchKey,
      deckStore.sortedDeckCards,
      searchText
    );

    // 結果をキャッシュ追跡に記録
    if (!isHit) {
      searchCache.set(searchKey, true);
    }

    return result;
  };

  /**
   * デッキ統計を取得（最適化版）
   */
  const getDeckStatistics = () => {
    // ストアから提供される軽量ハッシュを使用
    const deckHash = deckStore.deckHash;

    // 独自のキャッシュ追跡でヒット/ミスの判定
    const isHit = statsCache.has(deckHash);
    if (isHit) {
      statsHitCount++;
      console.debug(`Stats cache HIT for hash: ${deckHash.slice(0, 50)}...`);
    } else {
      console.debug(`Stats cache MISS for hash: ${deckHash.slice(0, 50)}...`);
    }

    const result = memoizedStatsCalculation(
      deckHash,
      deckStore.sortedDeckCards
    );

    // 結果をキャッシュ追跡に記録
    if (!isHit) {
      statsCache.set(deckHash, true);
    }

    return result;
  };

  /**
   * メモ化パフォーマンス統計を取得（デバッグ用）
   */
  const getMemoizationStats = () => {
    const statsTotal = statsHitCount + statsMissCount;
    const searchTotal = searchHitCount + searchMissCount;
    const overallTotal = statsTotal + searchTotal;
    const overallHits = statsHitCount + searchHitCount;

    return {
      stats: {
        hitCount: statsHitCount,
        missCount: statsMissCount,
        hitRatio:
          statsTotal > 0
            ? ((statsHitCount / statsTotal) * 100).toFixed(1)
            : "0.0",
        total: statsTotal,
      },
      search: {
        hitCount: searchHitCount,
        missCount: searchMissCount,
        hitRatio:
          searchTotal > 0
            ? ((searchHitCount / searchTotal) * 100).toFixed(1)
            : "0.0",
        total: searchTotal,
      },
      overall: {
        hitCount: overallHits,
        missCount: statsMissCount + searchMissCount,
        hitRatio:
          overallTotal > 0
            ? ((overallHits / overallTotal) * 100).toFixed(1)
            : "0.0",
        total: overallTotal,
      },
    };
  };

  /**
   * メモ化統計をリセット（デバッグ用）
   */
  const resetMemoizationStats = () => {
    statsHitCount = 0;
    statsMissCount = 0;
    searchHitCount = 0;
    searchMissCount = 0;
    statsCache.clear();
    searchCache.clear();
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

    // デバッグ機能（開発時のパフォーマンス測定用）
    getMemoizationStats,
    resetMemoizationStats,
  };
};
