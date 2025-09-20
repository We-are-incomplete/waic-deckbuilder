/**
 * @file カードストア
 * - 取得/検証/キャッシュ/プリロードのオーケストレーション
 */
import { CardDataConverterError } from "../utils/cardDataConverter";
import { defineStore } from "pinia";
import { ref, shallowRef, readonly, computed, markRaw, triggerRef } from "vue";
import type { Card } from "../types";
import { loadCardsFromCsv } from "../utils";
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
  | { readonly type: "validation"; readonly message: string }
  | { readonly type: "preload"; readonly message: string };

export const useCardsStore = defineStore("cards", () => {
  const availableCards = shallowRef<readonly Card[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<CardStoreError | null>(null);

  // カードデータのバージョン管理（キャッシュ無効化用）
  const cardsVersion = ref<number>(0);

  // パフォーマンス改善のためのキャッシュ（markRawで最適化）
  const cardByIdCache = markRaw(new Map<string, Card>());
  const cardsByKindCache = markRaw(new Map<string, readonly Card[]>());
  const availableKindsCache = shallowRef<readonly string[] | null>(null);
  const availableTypesCache = shallowRef<readonly string[] | null>(null);

  // シンプルな検索処理

  // CardStoreErrorに変換するヘルパー関数
  const mapErrorToCardStoreError = (e: unknown): CardStoreError => {
    // CardDataConverterError 由来
    if (e instanceof CardDataConverterError) {
      switch (e.type) {
        case "FetchError": {
          const httpHint =
            typeof e.originalError === "object" &&
            e.originalError &&
            "message" in e.originalError &&
            typeof (e.originalError as any).message === "string" &&
            (e.originalError as any).message.startsWith("HTTP error!");
          return {
            type: "fetch",
            status: httpHint ? 500 : 0,
            message:
              e.message ??
              (httpHint
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
    return CardDomain.searchCardsByName(availableCards.value, normalizedSearch);
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
    if (isLoading.value) return; // 再入防止
    isLoading.value = true;
    error.value = null;

    try {
      const cards = await loadCardsFromCsv(
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSBSkAVMH16J4iOgia3JKSwgpNG9gIWGu5a7OzdnuPmM2lvYW0MjchCBvy1i4ZS8aXJEPooubEivEfc/pub?gid=1598481515&single=true&output=csv",
      );

      const validCards = validateCards(cards);
      const ensuredCards = ensureValidCards(validCards);

      // 成功パス
      cardsVersion.value++;
      availableCards.value = readonly(ensuredCards);
      updateCaches(ensuredCards);

      // 事前プリロードは簡素化のため削除
      console.debug(`${ensuredCards.length}枚のカードを読み込みました`);
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
    availableCards: readonly(availableCards),
    isLoading: readonly(isLoading),
    error: readonly(error),
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
