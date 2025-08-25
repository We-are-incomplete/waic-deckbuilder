import { defineStore } from "pinia";
import { ref, shallowRef, readonly, computed, markRaw, triggerRef } from "vue";
import type { Card } from "../types";
import { preloadImages, logger } from "../utils";
import { safeAsyncOperation } from "../utils/errorHandler";
import * as CardDomain from "../domain/card";
import { ok, err, type Result } from "neverthrow";
import { useMemoize } from "@vueuse/core";
import { loadCardsFromCsv } from "../utils/cardDataConverter";

// カードストア専用のエラー型
type CardStoreError =
  | {
      readonly type: "fetch";
      readonly status: number;
      readonly message: string;
    }
  | { readonly type: "parse"; readonly message: string }
  | { readonly type: "validation"; readonly message: string }
  | { readonly type: "preload"; readonly message: string };

export const useCardsStore = defineStore("cards", () => {
  const availableCards = shallowRef<readonly Card[]>([]);
  const isLoading = ref<boolean>(true);
  const error = ref<CardStoreError | null>(null);

  // カードデータのバージョン管理（キャッシュ無効化用）
  const cardsVersion = ref<number>(0);

  // パフォーマンス改善のためのキャッシュ（markRawで最適化）
  const cardByIdCache = markRaw(new Map<string, Card>());
  const cardsByKindCache = markRaw(new Map<string, readonly Card[]>());
  const availableKindsCache = shallowRef<readonly string[] | null>(null);
  const availableTypesCache = shallowRef<readonly string[] | null>(null);

  // メモ化された検索処理
  const memoizedSearch = useMemoize(
    (params: {
      cards: readonly Card[];
      searchText: string;
      version: number;
    }) => {
      return CardDomain.searchCardsByName(params.cards, params.searchText);
    },
    {
      getKey: (params: {
        cards: readonly Card[];
        searchText: string;
        version: number;
      }) => {
        // cardsVersionだけでキャッシュの無効化を確実に行う
        return `${params.searchText}_v${params.version}`;
      },
    },
  );

  /**
   * カードデータを取得する純粋関数
   */
  const fetchCardData = async (): Promise<Result<Card[], unknown>> => {
    const cardsResult = await loadCardsFromCsv(
      "cards.csv",
    );
    if (cardsResult.isErr()) {
      return err(cardsResult.error);
    }
    return ok(cardsResult.value);
  };

  /**
   * カードデータを検証する純粋関数
   */
  const validateCards = (cards: Card[]): Card[] => {
    const validCards: Card[] = [];

    for (const card of cards) {
      // 基本的な検証
      if (!card.id || !card.name || !card.kind || !card.type) {
        logger.warn("不正なカードデータをスキップしました:", card);
        continue;
      }

      validCards.push(card);
    }

    return validCards;
  };

  /**
   * 有効なカードデータの存在を検証
   */
  const ensureValidCards = (cards: Card[]): Result<Card[], string> => {
    if (cards.length === 0) {
      return err("有効なカードデータが見つかりませんでした");
    }
    return ok(cards);
  };

  /**
   * キャッシュを更新する（最適化版）
   */
  const updateCaches = (cards: readonly Card[]): void => {
    // IDキャッシュの更新（バッチ処理で最適化）
    cardByIdCache.clear();
    const cardCount = cards.length;
    for (let i = 0; i < cardCount; i++) {
      const card = cards[i];
      cardByIdCache.set(card.id, card);
    }

    // 種別キャッシュの更新（並列処理で最適化）
    cardsByKindCache.clear();
    const kindGroups = markRaw(new Map<string, Card[]>());
    const kindSet = new Set<string>();
    const typeSet = new Set<string>();

    // 単一ループで全ての処理を実行
    for (let i = 0; i < cardCount; i++) {
      const card = cards[i];

      // 種別処理
      kindSet.add(card.kind);

      let kindCards = kindGroups.get(card.kind);
      if (!kindCards) {
        kindCards = [];
        kindGroups.set(card.kind, kindCards);
      }
      kindCards.push(card);

      // タイプ処理（最適化）
      card.type.forEach((type) => typeSet.add(type));
    }

    // 種別キャッシュに保存（メモリ効率的に）
    for (const [kind, kindCards] of kindGroups) {
      cardsByKindCache.set(kind, readonly(kindCards));
    }

    // 利用可能な種別・タイプのキャッシュ更新
    availableKindsCache.value = readonly(Array.from(kindSet).sort());
    availableTypesCache.value = readonly(Array.from(typeSet).sort());
  };

  /**
   * カードを名前で検索（メモ化版）
   */
  const searchCardsByName = (searchText: string): readonly Card[] => {
    if (!searchText || searchText.trim().length === 0) {
      return availableCards.value;
    }

    const normalizedSearch = searchText.trim().toLowerCase();
    return memoizedSearch({
      cards: availableCards.value,
      searchText: normalizedSearch,
      version: cardsVersion.value,
    });
  };

  /**
   * カードをIDで取得（最適化版）
   */
  const getCardById = (cardId: string): Card | undefined => {
    return cardByIdCache.get(cardId);
  };

  /**
   * カードを種別でフィルタリング（最適化版）
   */
  const getCardsByKind = (kind: string): readonly Card[] => {
    const cached = cardsByKindCache.get(kind);
    if (cached) {
      return cached;
    }

    // キャッシュにない場合はフィルタリングして追加
    const result = availableCards.value.filter((card) => {
      return card.kind === kind;
    });

    const readonlyResult = readonly(result);
    cardsByKindCache.set(kind, readonlyResult);
    return readonlyResult;
  };

  /**
   * 全キャッシュクリア（最適化版）
   */
  const clearAllCaches = (): void => {
    // cardsVersionを単調増加させることで古いキャッシュヒットを防ぐ
    cardsVersion.value++;
    cardByIdCache.clear();
    cardsByKindCache.clear();
    availableKindsCache.value = null;
    availableTypesCache.value = null;
    // memoizedSearchのキャッシュもクリア（防御的チェック）
    if (typeof memoizedSearch.clear === "function") {
      memoizedSearch.clear();
    }
    triggerRef(availableKindsCache);
    triggerRef(availableTypesCache);
  };

  /**
   * 利用可能なカード種別を取得（最適化版）
   */
  const getAvailableKinds = (): readonly string[] => {
    if (availableKindsCache.value) {
      return availableKindsCache.value;
    }

    // キャッシュがない場合は再計算
    const kinds = new Set<string>();
    for (const card of availableCards.value) {
      kinds.add(card.kind);
    }

    const result = readonly([...kinds].sort());
    availableKindsCache.value = result;
    return result;
  };

  /**
   * 利用可能なカードタイプを取得（最適化版）
   */
  const getAvailableTypes = (): readonly string[] => {
    if (availableTypesCache.value) {
      return availableTypesCache.value;
    }

    // キャッシュがない場合は再計算
    const types = new Set<string>();
    for (const card of availableCards.value) {
      card.type.forEach((type) => types.add(type));
    }

    const result = readonly([...types].sort());
    availableTypesCache.value = result;
    return result;
  };

  /**
   * カードデータを読み込む
   */
  const loadCards = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    const result = await safeAsyncOperation(async () => {
      // データ取得
      const fetchResult = await fetchCardData();
      if (fetchResult.isErr()) {
        throw fetchResult.error;
      }
      const rawCards = fetchResult.value;

      // データ検証
      const validCards = validateCards(rawCards);

      // 有効なカードの存在を確認
      const checkedCardsResult = ensureValidCards(validCards);
      if (checkedCardsResult.isErr()) {
        throw new Error(checkedCardsResult.error);
      }
      const checkedCards = checkedCardsResult.value;

      // キャッシュバージョンを先に更新（新しいデータ設定前に）
      // 重要: memoizedSearchのキャッシュ無効化はcardsVersionにのみ依存し、
      // cardsの配列参照には依存しない。カードの配列内容が変更される場合は、
      // 古い検索結果を防ぐために必ずcardsVersionをインクリメントする必要がある
      cardsVersion.value++;

      // ストアに設定
      availableCards.value = readonly(checkedCards);

      // キャッシュの更新
      updateCaches(checkedCards);

      // 画像プリロード（非同期、エラーでも続行）
      const preloadResult = preloadImages(checkedCards);
      if (preloadResult.isErr()) {
        logger.warn("画像のプリロードに失敗しました:", preloadResult.error);
        // プリロードの失敗は致命的ではないので続行
      }

      logger.info(`${checkedCards.length}枚のカードを読み込みました`);
    }, "カードデータの読み込み");

    if (result.isErr()) {
      const errorMessage = result.error.message;

      if (errorMessage.includes("HTTP error")) {
        const statusMatch = errorMessage.match(/status: (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;
        error.value = {
          type: "fetch",
          status,
          message: "カードデータの取得に失敗しました",
        };
      } else if (errorMessage.includes("形式が不正")) {
        error.value = {
          type: "parse",
          message: "カードデータの解析に失敗しました",
        };
      } else if (errorMessage.includes("有効なカード")) {
        error.value = {
          type: "validation",
          message: "有効なカードデータが見つかりませんでした",
        };
      } else {
        error.value = {
          type: "fetch",
          status: 500,
          message: "カードデータの読み込みに失敗しました",
        };
      }

      logger.error("カードデータの読み込みエラー:", result.error);
    }

    isLoading.value = false;
  };

  /**
   * エラーをクリア
   */
  const clearError = (): void => {
    error.value = null;
  };

  /**
   * キャッシュをクリア（デバッグ用）
   */
  const clearCaches = (): void => {
    clearAllCaches();
  };

  // 計算プロパティ
  const cardCount = computed(() => availableCards.value.length);
  const hasCards = computed(() => cardCount.value > 0);
  const isReady = computed(
    () => !isLoading.value && !error.value && hasCards.value,
  );

  return {
    // リアクティブな状態
    availableCards,
    isLoading,
    error,
    cardCount,
    hasCards,
    isReady,

    // アクション
    loadCards,
    clearError,
    clearCaches,

    // ユーティリティ関数
    searchCardsByName,
    getCardById,
    getCardsByKind,
    getAvailableKinds,
    getAvailableTypes,
  };
});
