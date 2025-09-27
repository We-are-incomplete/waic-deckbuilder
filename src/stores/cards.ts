/**
 * @file カードストア
 * - 取得/検証/キャッシュ/プリロードのオーケストレーション
 */
import { CardDataConverterError } from "../utils/cardDataConverter";
import { defineStore } from "pinia";
import { ref, shallowRef, readonly, computed, markRaw } from "vue";
import type { Card } from "../types";
import { loadCardsFromCsv, getNormalizedBaseUrl } from "../utils";
import * as CardDomain from "../domain";

// メモ化は削除し、シンプルな検索に戻す

// カードストア専用のエラー型
type CardStoreError =
  | {
      readonly type: "fetch";
      readonly status: number;
      readonly message: string;
    }
  | { readonly type: "parse"; readonly message: string }
  | { readonly type: "validation"; readonly message: string };

export const useCardsStore = defineStore("cards", () => {
  const availableCards = shallowRef<readonly Card[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<CardStoreError | null>(null);

  // パフォーマンス改善のためのキャッシュ（markRawで最適化）
  const cardByIdCache = markRaw(new Map<string, Readonly<Card>>());

  // シンプルな検索処理

  // CardStoreErrorに変換するヘルパー関数
  const mapErrorToCardStoreError = (e: unknown): CardStoreError => {
    // CardDataConverterError 由来
    if (e instanceof CardDataConverterError) {
      switch (e.type) {
        case "FetchError": {
          const httpMatch = /\bHTTP\s+(\d{3})\b/.exec(e.message ?? "");
          const httpStatus = httpMatch ? Number(httpMatch[1]) : 0;
          return {
            type: "fetch",
            status: httpStatus,
            message:
              e.message ??
              (httpStatus >= 400
                ? "サーバーエラーが発生しました"
                : "ネットワークエラーが発生しました"),
          };
        }
        case "EmptyCsvError":
          return {
            type: "parse",
            message: e.message ?? "カードデータの解析に失敗しました",
          };
        case "ParseError":
          return {
            type: "parse",
            message: e.message ?? "カードデータの解析に失敗しました",
          };
        case "ValidationError":
          return {
            type: "validation",
            message: e.message ?? "カードデータが不正です",
          };
        default:
          return {
            type: "fetch",
            status: 500,
            message: e.message ?? "不明なカードデータの読み込みエラー",
          };
      }
    } else if (typeof e === "string") {
      // ensureValidCardsからのエラー（string）
      if (e.includes("有効なカードデータが見つかりませんでした")) {
        return {
          type: "validation",
          message: "有効なカードデータが見つかりませんでした",
        };
      }
    }
    // その他の不明なエラー
    return {
      type: "fetch",
      status: 500,
      message: "不明なカードデータの読み込みエラー",
    };
  };

  /**
   * カードデータを検証する純粋関数
   */
  const validateCards = (cards: Card[]): Card[] => {
    const validCards: Card[] = [];

    for (const card of cards) {
      // 基本的な検証
      if (!card.id || !card.name || !card.kind || !card.type) {
        console.warn("不正なカードデータをスキップしました:", card);
        continue;
      }

      // effectプロパティに基づいてhasEntryConditionを設定
      const cardWithEntryCondition: Card = {
        ...card,
        hasEntryCondition: card.effect?.includes("【登場条件】") || false,
      };

      validCards.push(cardWithEntryCondition);
    }

    return validCards;
  };

  /**
   * 有効なカードデータの存在を検証
   */
  const ensureValidCards = (cards: Card[]): Card[] => {
    if (cards.length === 0) {
      throw new CardDataConverterError({
        type: "ValidationError",
        message: "有効なカードデータが見つかりませんでした",
      });
    }
    return cards;
  };

  /**
   * キャッシュを更新する（最適化版）
   */
  const updateCaches = (cards: readonly Card[]): void => {
    // IDキャッシュの更新（バッチ処理で最適化）
    cardByIdCache.clear();
    for (const card of cards) {
      cardByIdCache.set(card.id, readonly(card));
    }
  };

  /**
   * カードを名前で検索
   */
  const searchCardsByName = (searchText: string): readonly Card[] => {
    if (!searchText || searchText.trim().length === 0) {
      return availableCards.value;
    }
    return CardDomain.searchCardsByName(availableCards.value, searchText);
  };

  /**
   * カードをIDで取得（最適化版）
   */
  const getCardById = (cardId: string): Readonly<Card> | undefined => {
    return cardByIdCache.get(cardId);
  };

  /**
   * カードデータを読み込む
   */
  const loadCards = async (): Promise<void> => {
    if (isLoading.value) return; // 再入防止
    isLoading.value = true;
    error.value = null;

    try {
      const normalized = getNormalizedBaseUrl();
      const cards = await loadCardsFromCsv(`${normalized}card-data.csv`);

      const validCards = validateCards(cards);
      const ensuredCards = ensureValidCards(validCards);

      // 成功パス
      availableCards.value = readonly(ensuredCards);
      updateCaches(ensuredCards);

      // 事前プリロードは簡素化のため削除
    } catch (e) {
      const mapped = mapErrorToCardStoreError(e);
      error.value = mapped;
      console.error(
        "カードデータの読み込み中に予期せぬエラーが発生しました:",
        mapped,
        {
          cause: e,
        },
      );
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * エラーをクリア
   */
  const clearError = (): void => {
    error.value = null;
  };

  // 計算プロパティ
  const cardCount = computed(() => availableCards.value.length);
  const hasCards = computed(() => cardCount.value > 0);
  const isReady = computed(
    () => !isLoading.value && !error.value && hasCards.value,
  );

  return {
    // リアクティブな状態
    availableCards: readonly(availableCards),
    isLoading: readonly(isLoading),
    error: readonly(error),
    cardCount,
    hasCards,
    isReady,

    // アクション
    loadCards,
    clearError,

    // ユーティリティ関数
    searchCardsByName,
    getCardById,
  };
});
