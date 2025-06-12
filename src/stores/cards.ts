import { defineStore } from "pinia";
import { ref, shallowRef, readonly, computed, markRaw, triggerRef } from "vue";
import type { Card } from "../types";
import { preloadImages, logger } from "../utils";
import { safeAsyncOperation } from "../utils/errorHandler";
import * as CardDomain from "../domain/card";
import { fromAsyncThrowable, ok, err, type Result } from "neverthrow";
import { useMemoize } from "@vueuse/core";

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

  // パフォーマンス改善のためのキャッシュ（markRawで最適化）
  const cardByIdCache = markRaw(new Map<string, Card>());
  const cardsByKindCache = markRaw(new Map<string, readonly Card[]>());
  const availableKindsCache = shallowRef<readonly string[] | null>(null);
  const availableTypesCache = shallowRef<readonly string[] | null>(null);

  // インデックス化されたキャッシュ（高速検索用）
  const cardSearchIndex = markRaw(new Map<string, Set<Card>>());
  const isIndexBuilt = ref(false);

  // メモ化された検索処理
  const memoizedSearch = useMemoize(
    (params: { cards: readonly Card[]; searchText: string }) => {
      return CardDomain.searchCardsByName(params.cards, params.searchText);
    },
    {
      getKey: (params: { cards: readonly Card[]; searchText: string }) => {
        // カード配列の代わりに軽量な識別子を使用（カード数 + 検索テキスト）
        return `${params.cards.length}_${params.searchText}`;
      },
    }
  );

  /**
   * カードデータを取得する純粋関数
   */
  const fetchCardData = async (): Promise<Result<Card[], unknown>> => {
    const safeFetch = fromAsyncThrowable(
      async (): Promise<Card[]> => {
        const response = await fetch(`${import.meta.env.BASE_URL}cards.json`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("カードデータの形式が不正です");
        }

        return data;
      },
      (error: unknown) => error
    );

    return await safeFetch();
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
   * 検索インデックスを構築（高速検索のため）
   */
  const buildSearchIndex = (cards: readonly Card[]): void => {
    cardSearchIndex.clear();

    for (const card of cards) {
      // カード名での検索インデックス
      const nameTokens = card.name.toLowerCase().split(/\s+/);
      for (const token of nameTokens) {
        if (token.length >= 2) {
          // 2文字以上のトークンのみ
          if (!cardSearchIndex.has(token)) {
            cardSearchIndex.set(token, new Set());
          }
          cardSearchIndex.get(token)!.add(card);
        }
      }

      // フルネームでのインデックス
      const fullName = card.name.toLowerCase();
      if (!cardSearchIndex.has(fullName)) {
        cardSearchIndex.set(fullName, new Set());
      }
      cardSearchIndex.get(fullName)!.add(card);
    }

    isIndexBuilt.value = true;
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
      if (Array.isArray(card.type)) {
        card.type.forEach((type) => typeSet.add(type));
      } else {
        typeSet.add(card.type);
      }
    }

    // 種別キャッシュに保存（メモリ効率的に）
    for (const [kind, kindCards] of kindGroups) {
      cardsByKindCache.set(kind, readonly(kindCards));
    }

    // 利用可能な種別・タイプのキャッシュ更新
    availableKindsCache.value = readonly(Array.from(kindSet).sort());
    availableTypesCache.value = readonly(Array.from(typeSet).sort());

    // 検索インデックスの構築
    buildSearchIndex(cards);
  };

  /**
   * カードを名前で検索（インデックス利用の超高速版）
   */
  const searchCardsByName = (searchText: string): readonly Card[] => {
    if (!searchText || searchText.trim().length === 0) {
      return availableCards.value;
    }

    const normalizedSearch = searchText.trim().toLowerCase();

    // インデックスが構築されている場合は高速検索を使用
    if (isIndexBuilt.value && cardSearchIndex.size > 0) {
      const searchTokens = normalizedSearch
        .split(/\s+/)
        .filter((token) => token.length >= 2);

      if (searchTokens.length === 0) {
        // 短すぎる検索語の場合はフォールバック
        return CardDomain.searchCardsByName(availableCards.value, searchText);
      }

      let resultSets: Set<Card>[] = [];

      // 各トークンにマッチするカードセットを収集
      for (const token of searchTokens) {
        const matchingCards = new Set<Card>();

        // 完全一致
        const exactMatch = cardSearchIndex.get(token);
        if (exactMatch) {
          for (const card of exactMatch) {
            matchingCards.add(card);
          }
        }

        // 部分一致（プレフィックス検索）
        for (const [indexToken, cards] of cardSearchIndex) {
          if (indexToken.includes(token) && indexToken !== token) {
            for (const card of cards) {
              matchingCards.add(card);
            }
          }
        }

        if (matchingCards.size > 0) {
          resultSets.push(matchingCards);
        }
      }

      if (resultSets.length === 0) {
        return readonly([]);
      }

      // 全てのトークンにマッチするカードを見つける（積集合）
      let intersection = resultSets[0];
      for (let i = 1; i < resultSets.length; i++) {
        const newIntersection = new Set<Card>();
        for (const card of intersection) {
          if (resultSets[i].has(card)) {
            newIntersection.add(card);
          }
        }
        intersection = newIntersection;
      }

      return readonly(Array.from(intersection));
    }

    // メモ化検索をフォールバックとして使用
    return memoizedSearch({
      cards: availableCards.value,
      searchText: normalizedSearch,
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
    cardByIdCache.clear();
    cardsByKindCache.clear();
    cardSearchIndex.clear();
    availableKindsCache.value = null;
    availableTypesCache.value = null;
    isIndexBuilt.value = false;
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
      if (Array.isArray(card.type)) {
        card.type.forEach((type) => types.add(type));
      } else {
        types.add(card.type);
      }
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
    () => !isLoading.value && !error.value && hasCards.value
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
