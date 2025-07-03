import { computed, type ComputedRef } from "vue";
import type { Card } from "../types/card";
import type { DeckCard, DeckOperation } from "../types/deck";
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

  /**
   * メモ化関数の統一ラッパー
   * キャッシュキーを事前にチェックしてヒット/ミスを正確にカウント
   */
  const createMemoizationWrapper = <TArgs extends readonly unknown[], TReturn>(
    memoizedFn: (...args: TArgs) => TReturn,
    getKey: (...args: TArgs) => string,
    statsType: "stats" | "search",
  ) => {
    return (...args: TArgs): TReturn => {
      // キャッシュキーを生成
      const cacheKey = getKey(...args);

      // キャッシュに既にキーが存在するかチェック
      const cache = (memoizedFn as any).cache || (memoizedFn as any)._cache;
      const isHit = cache && cache.has && cache.has(cacheKey);

      const result = memoizedFn(...args);

      if (statsType === "stats") {
        if (isHit) {
          statsHitCount++;
          console.debug(`Stats cache HIT`);
        } else {
          statsMissCount++;
          console.debug(`Stats cache MISS`);
        }
      } else {
        if (isHit) {
          searchHitCount++;
          console.debug(`Search cache HIT`);
        } else {
          searchMissCount++;
          console.debug(`Search cache MISS`);
        }
      }

      return result;
    };
  };

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
  const memoizedStatsCalculation = createMemoizationWrapper(
    baseMemoizedStatsCalculation,
    (deckHash: string) => createSafeHash(deckHash),
    "stats",
  );

  const memoizedDeckSearch = createMemoizationWrapper(
    baseMemoizedDeckSearch,
    (searchKey: string) => createSafeHash(searchKey),
    "search",
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
          `カード「${card.name}」は既に最大枚数です`,
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
   * デッキ操作を安全に実行する共通ヘルパー関数
   * 成功時はストアを更新してtrue、失敗時はエラーハンドリングしてfalseを返す
   */
  const executeDeckOperationSafely = <T extends DeckOperation>(
    operation: T,
    errorMessage: string,
  ): boolean => {
    const result = DeckDomain.executeDeckOperation(
      deckStore.deckCards,
      operation,
    );

    if (result.isOk()) {
      deckStore.setDeckCards([...result.value]);
      return true;
    }

    errorHandler.handleValidationError(
      `${errorMessage}: ${result.error.type}`,
      result.error,
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
   * 統計カウンターとメモ化キャッシュの両方をクリア
   */
  const resetMemoizationStats = () => {
    statsHitCount = 0;
    statsMissCount = 0;
    searchHitCount = 0;
    searchMissCount = 0;

    // メモ化キャッシュもクリア
    baseMemoizedStatsCalculation.clear?.();
    baseMemoizedDeckSearch.clear?.();
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
