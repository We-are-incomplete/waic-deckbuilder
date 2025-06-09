import { defineStore } from "pinia";
import { ref, shallowRef, readonly, computed } from "vue";
import type { Card } from "../types";
import { preloadImages, logger } from "../utils";
import {
  safeAsyncOperation,
  type ShowToastFunction,
} from "../utils/errorHandler";
import * as CardDomain from "../domain/card";
import { fromAsyncThrowable, ok, err, type Result } from "neverthrow";

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

  // エラーハンドラー
  let showToast: ShowToastFunction | undefined;

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
   * カードを名前で検索
   */
  const searchCardsByName = (searchText: string): readonly Card[] => {
    return CardDomain.searchCardsByName(availableCards.value, searchText);
  };

  /**
   * カードをIDで取得
   */
  const getCardById = (cardId: string): Card | undefined => {
    return availableCards.value.find((card) => card.id === cardId);
  };

  /**
   * カードを種別でフィルタリング
   */
  const getCardsByKind = (kind: string): readonly Card[] => {
    return availableCards.value.filter((card) => {
      const cardKind =
        typeof card.kind === "string" ? card.kind : String(card.kind);
      return cardKind === kind;
    });
  };

  /**
   * 利用可能なカード種別を取得
   */
  const getAvailableKinds = (): readonly string[] => {
    const kinds = new Set<string>();
    for (const card of availableCards.value) {
      const cardKind =
        typeof card.kind === "string" ? card.kind : String(card.kind);
      kinds.add(cardKind);
    }
    return [...kinds].sort();
  };

  /**
   * 利用可能なカードタイプを取得
   */
  const getAvailableTypes = (): readonly string[] => {
    const types = new Set<string>();
    for (const card of availableCards.value) {
      if (typeof card.type === "string") {
        types.add(card.type);
      } else if (Array.isArray(card.type)) {
        card.type.forEach((type) => {
          const typeStr = typeof type === "string" ? type : String(type);
          types.add(typeStr);
        });
      } else {
        types.add(String(card.type));
      }
    }
    return [...types].sort();
  };

  /**
   * カードデータを読み込む
   */
  const loadCards = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    const result = await safeAsyncOperation(
      async () => {
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

        // 画像プリロード（非同期、エラーでも続行）
        const preloadResult = preloadImages(checkedCards);
        if (preloadResult.isErr()) {
          logger.warn("画像のプリロードに失敗しました:", preloadResult.error);
          // プリロードの失敗は致命的ではないので続行
        }

        logger.info(`${checkedCards.length}枚のカードを読み込みました`);
      },
      "カードデータの読み込み",
      showToast
    );

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
   * トースト表示関数を設定
   */
  const setToastFunction = (toastFunc: ShowToastFunction): void => {
    showToast = toastFunc;
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
    setToastFunction,

    // ユーティリティ関数
    searchCardsByName,
    getCardById,
    getCardsByKind,
    getAvailableKinds,
    getAvailableTypes,
  };
});
