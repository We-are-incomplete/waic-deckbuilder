import { defineStore } from "pinia";
import { ref, readonly, computed, shallowRef, markRaw, triggerRef } from "vue";
import type { Card, FilterCriteria } from "../types";
import { CARD_KINDS, CARD_TYPES, PRIORITY_TAGS } from "../constants/game";
import * as CardDomain from "../domain/card";
import { useCardsStore } from "./cards";
import { sortCards } from "../domain/sort";
import { useMemoize } from "@vueuse/core";

export const useFilterStore = defineStore("filter", () => {
  const isFilterModalOpen = ref<boolean>(false);
  const filterCriteria = shallowRef<FilterCriteria>({
    text: "",
    kind: [],
    type: [],
    tags: [],
  });

  // WeakMapを使って配列のメモIDを管理（Vueのリアクティビティを壊さない）
  const arrayMemoIds = new WeakMap<readonly Card[], string>();

  // メモ化されたソート処理（より効率的な実装）
  const memoizedCardSorting = useMemoize(
    (cards: readonly Card[]) => {
      // 配列の参照が同じ場合は何もしない
      if (cards.length === 0) return cards;
      return readonly(sortCards(cards));
    },
    {
      getKey: (cards) => {
        // WeakMapを使用して配列参照をキーとして使用（JSON.stringifyによる高コストを回避）
        let memoId = arrayMemoIds.get(cards);
        if (!memoId) {
          memoId = Math.random().toString(36);
          arrayMemoIds.set(cards, memoId);
        }
        return memoId;
      },
    }
  );

  // より効率的なフィルタリング実装
  const memoizedFilterApplication = useMemoize(
    (params: { cards: readonly Card[]; criteria: FilterCriteria }) => {
      const { cards, criteria } = params;

      // 早期リターンでパフォーマンス改善
      if (isEmptyFilter(criteria)) {
        return cards;
      }

      return applyAllFiltersOptimized(cards, criteria);
    },
    {
      getKey: (params) => {
        const { cards, criteria } = params;
        // cardsの参照IDとcriteriaの内容ハッシュでキーを生成
        let cardsRefId = arrayMemoIds.get(cards);
        if (!cardsRefId) {
          cardsRefId = Math.random().toString(36);
          arrayMemoIds.set(cards, cardsRefId);
        }
        const criteriaHash = [
          criteria.text.trim(),
          [...criteria.kind].sort().join(","),
          [...criteria.type].sort().join(","),
          [...criteria.tags].sort().join(","),
        ].join("|");
        return `${cardsRefId}:${criteriaHash}`;
      },
    }
  );

  // タグ抽出の最適化（Set操作を効率化）
  const memoizedTagExtraction = useMemoize(
    (cards: readonly Card[]) => {
      if (cards.length === 0) return new Set<string>();

      const tags = new Set<string>();
      const cardCount = cards.length;

      // より効率的なループ処理
      for (let i = 0; i < cardCount; i++) {
        const card = cards[i];
        const cardTags = card.tags;

        if (cardTags) {
          if (Array.isArray(cardTags)) {
            const tagCount = cardTags.length;
            for (let j = 0; j < tagCount; j++) {
              tags.add(cardTags[j]);
            }
          } else if (typeof cardTags === "string") {
            // 単一の文字列タグの場合
            tags.add(cardTags);
          }
        }
      }

      return tags;
    },
    {
      getKey: (cards) => {
        // WeakMapを使用して配列参照をキーとして使用（JSON.stringifyによる高コストを回避）
        let memoId = arrayMemoIds.get(cards);
        if (!memoId) {
          memoId = Math.random().toString(36);
          arrayMemoIds.set(cards, memoId);
        }
        return memoId;
      },
    }
  );

  // シンプルなMapベースの文字列正規化キャッシュ（markRawで最適化）
  const stringNormalizationCache = markRaw(new Map<string, string>());
  const normalizeString = (str: string): string => {
    const cached = stringNormalizationCache.get(str);
    if (cached !== undefined) return cached;

    const normalized = str.trim().toLowerCase();

    // キャッシュサイズ制限（メモリリーク防止）
    if (stringNormalizationCache.size >= 1000) {
      // 古いエントリをクリア
      stringNormalizationCache.clear();
    }

    stringNormalizationCache.set(str, normalized);
    return normalized;
  };

  // 高速なSet操作のための最適化されたキャッシュ
  const fastSetCache = markRaw(new Map<string, Set<string>>());
  const createFastSet = (items: readonly string[]): Set<string> => {
    const key = items.join("|");
    const cached = fastSetCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const set = new Set(items);

    // キャッシュサイズ制限
    if (fastSetCache.size >= 100) {
      fastSetCache.clear();
    }

    fastSetCache.set(key, set);
    return set;
  };

  /**
   * 全タグリスト（優先タグを先頭に配置）- 最適化版
   */
  const allTags = computed(() => {
    const cardsStore = useCardsStore();

    const tags = memoizedTagExtraction(cardsStore.availableCards);

    if (tags.size === 0) {
      return readonly([]);
    }

    const priorityTagSet = new Set(PRIORITY_TAGS);
    const priorityTags = new Set<string>();
    const otherTags: string[] = [];

    // 一度のループで分類
    for (const tag of tags) {
      if (priorityTagSet.has(tag)) {
        priorityTags.add(tag);
      } else {
        otherTags.push(tag);
      }
    }

    // 優先タグは元の順序を保持、その他のタグはソート
    const orderedPriorityTags = PRIORITY_TAGS.filter((tag) =>
      priorityTags.has(tag)
    );
    otherTags.sort();

    return readonly([...orderedPriorityTags, ...otherTags]);
  });

  /**
   * 最適化されたテキストフィルタリング
   */
  const applyTextFilter = (
    cards: readonly Card[],
    text: string
  ): readonly Card[] => {
    if (!text || text.trim().length === 0) {
      return cards;
    }

    const normalizedText = normalizeString(text);
    if (normalizedText.length === 0) {
      return cards;
    }

    return CardDomain.searchCardsByName(cards, text);
  };

  /**
   * 最適化された種別フィルタリング（高速Set使用）
   */
  const applyKindFilter = (
    cards: readonly Card[],
    kinds: readonly string[]
  ): readonly Card[] => {
    if (kinds.length === 0) {
      return cards;
    }

    // 高速なSet を使用した効率的なルックアップ
    const kindSet = createFastSet(kinds);
    const result: Card[] = [];
    const cardCount = cards.length;

    // バッチ処理で最適化
    for (let i = 0; i < cardCount; i++) {
      const card = cards[i];
      const cardKind = card.kind;

      if (kindSet.has(cardKind)) {
        result.push(card);
      }
    }

    return readonly(result);
  };

  /**
   * 最適化されたタイプフィルタリング（高速Set使用）
   */
  const applyTypeFilter = (
    cards: readonly Card[],
    types: readonly string[]
  ): readonly Card[] => {
    if (types.length === 0) {
      return cards;
    }

    const typeSet = createFastSet(types);
    const result: Card[] = [];
    const cardCount = cards.length;

    // より効率的なループ処理
    for (let i = 0; i < cardCount; i++) {
      const card = cards[i];
      let hasMatchingType = false;

      hasMatchingType = typeSet.has(card.type);

      if (hasMatchingType) {
        result.push(card);
      }
    }

    return readonly(result);
  };

  /**
   * 最適化されたタグフィルタリング
   */
  const applyTagFilter = (
    cards: readonly Card[],
    tags: readonly string[]
  ): readonly Card[] => {
    if (tags.length === 0) {
      return cards;
    }

    const tagSet = createFastSet(tags);
    const result: Card[] = [];
    const cardCount = cards.length;

    for (let i = 0; i < cardCount; i++) {
      const card = cards[i];
      const cardTags = card.tags;

      if (!cardTags) continue;

      let hasMatchingTag = false;

      if (Array.isArray(cardTags)) {
        const tagCount = cardTags.length;
        for (let j = 0; j < tagCount && !hasMatchingTag; j++) {
          hasMatchingTag = tagSet.has(cardTags[j]);
        }
      }

      if (hasMatchingTag) {
        result.push(card);
      }
    }

    return readonly(result);
  };

  /**
   * 最適化された複合フィルタリング
   */
  const applyAllFiltersOptimized = (
    cards: readonly Card[],
    criteria: FilterCriteria
  ): readonly Card[] => {
    let filteredCards = cards;

    // フィルターの効果を推定し、最も絞り込み効果の高いものから適用
    const hasTextFilter = criteria.text && criteria.text.trim().length > 0;
    const hasKindFilter = criteria.kind.length > 0;
    const hasTypeFilter = criteria.type.length > 0;
    const hasTagFilter = criteria.tags.length > 0;

    // 早期リターンによる最適化
    if (!hasTextFilter && !hasKindFilter && !hasTypeFilter && !hasTagFilter) {
      return filteredCards;
    }

    // フィルターを選択性の高い順に適用（一般的に最も絞り込み効果が高いと思われる順）
    if (hasTextFilter) {
      filteredCards = applyTextFilter(filteredCards, criteria.text);
      if (filteredCards.length === 0) return filteredCards; // 早期リターン
    }

    if (hasTagFilter) {
      filteredCards = applyTagFilter(filteredCards, criteria.tags);
      if (filteredCards.length === 0) return filteredCards; // 早期リターン
    }

    if (hasKindFilter) {
      filteredCards = applyKindFilter(filteredCards, criteria.kind);
      if (filteredCards.length === 0) return filteredCards; // 早期リターン
    }

    if (hasTypeFilter) {
      filteredCards = applyTypeFilter(filteredCards, criteria.type);
    }

    return filteredCards;
  };

  /**
   * ソート・フィルター済みカード一覧 - 最適化版（早期リターン強化）
   */
  const sortedAndFilteredCards = computed(() => {
    const cardsStore = useCardsStore();
    const cards = cardsStore.availableCards;

    // 空の場合は早期リターン
    if (cards.length === 0) {
      return readonly([]);
    }

    // フィルターが空の場合はソートのみ実行
    const currentCriteria = filterCriteria.value;
    if (isEmptyFilter(currentCriteria)) {
      return memoizedCardSorting(cards);
    }

    let result: readonly Card[] = cards;

    // フィルタリングの適用（メモ化優先）
    result = memoizedFilterApplication({
      cards,
      criteria: currentCriteria,
    });

    // 結果が空の場合は早期リターン
    if (result.length === 0) {
      return readonly([]);
    }

    // ソートの適用
    return memoizedCardSorting(result);
  });

  /**
   * フィルター結果の統計情報 - 最適化版
   */
  const filterStats = computed(() => {
    const cardsStore = useCardsStore();
    const total = cardsStore.availableCards.length;
    const filtered = sortedAndFilteredCards.value.length;

    return {
      totalCount: total,
      filteredCount: filtered,
      hasFilter: !isEmptyFilter(filterCriteria.value),
      filterRate: total > 0 ? filtered / total : 0,
    };
  });

  /**
   * フィルターが空かどうか判定 - 最適化版
   */
  const isEmptyFilter = (criteria: FilterCriteria): boolean => {
    return (
      (!criteria.text || criteria.text.trim().length === 0) &&
      criteria.kind.length === 0 &&
      criteria.type.length === 0 &&
      criteria.tags.length === 0
    );
  };

  /**
   * フィルターモーダルを開く
   */
  const openFilterModal = (): void => {
    isFilterModalOpen.value = true;
  };

  /**
   * フィルターモーダルを閉じる
   */
  const closeFilterModal = (): void => {
    isFilterModalOpen.value = false;
  };

  /**
   * フィルター条件を更新
   */
  const updateFilterCriteria = (criteria: FilterCriteria): void => {
    filterCriteria.value = { ...criteria };
    triggerRef(filterCriteria); // 手動でリアクティブ更新をトリガー
  };

  /**
   * フィルター条件をリセット
   */
  const resetFilterCriteria = (): void => {
    filterCriteria.value = {
      text: "",
      kind: [],
      type: [],
      tags: [],
    };
  };

  /**
   * テキストフィルターのみ設定
   */
  const setTextFilter = (text: string): void => {
    filterCriteria.value = {
      ...filterCriteria.value,
      text: text.trim(),
    };
  };

  /**
   * 種別フィルターを切り替え
   */
  const toggleKindFilter = (kind: string): void => {
    const currentKinds: string[] = [...filterCriteria.value.kind];
    const index = currentKinds.indexOf(kind);

    if (index > -1) {
      currentKinds.splice(index, 1);
    } else {
      currentKinds.push(kind);
    }

    filterCriteria.value = {
      ...filterCriteria.value,
      kind: currentKinds,
    };
  };

  /**
   * タイプフィルターを切り替え
   */
  const toggleTypeFilter = (type: string): void => {
    const currentTypes: string[] = [...filterCriteria.value.type];
    const index = currentTypes.indexOf(type);

    if (index > -1) {
      currentTypes.splice(index, 1);
    } else {
      currentTypes.push(type);
    }

    filterCriteria.value = {
      ...filterCriteria.value,
      type: currentTypes,
    };
  };

  /**
   * タグフィルターを切り替え
   */
  const toggleTagFilter = (tag: string): void => {
    const currentTags = [...filterCriteria.value.tags];
    const index = currentTags.indexOf(tag);

    if (index > -1) {
      currentTags.splice(index, 1);
    } else {
      currentTags.push(tag);
    }

    filterCriteria.value = {
      ...filterCriteria.value,
      tags: currentTags,
    };
  };

  return {
    // リアクティブな状態
    isFilterModalOpen,
    filterCriteria,
    allTags,
    sortedAndFilteredCards,
    filterStats,

    // 定数
    allKinds: readonly([...CARD_KINDS]),
    allTypes: readonly([...CARD_TYPES]),

    // アクション
    openFilterModal,
    closeFilterModal,
    updateFilterCriteria,
    resetFilterCriteria,
    setTextFilter,
    toggleKindFilter,
    toggleTypeFilter,
    toggleTagFilter,

    // ユーティリティ
    isEmptyFilter: computed(() => isEmptyFilter(filterCriteria.value)),
  };
});
