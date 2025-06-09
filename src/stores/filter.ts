import { defineStore } from "pinia";
import { ref, readonly, computed } from "vue";
import type { Card, FilterCriteria } from "../types";
import { CARD_KINDS, CARD_TYPES, PRIORITY_TAGS } from "../constants/game";
import * as CardDomain from "../domain/card";
import {
  memoizeArrayComputation,
  memoizeObjectComputation,
} from "../utils/memoization";
import { useCardsStore } from "./cards";
import { sortCards } from "../domain/sort";

export const useFilterStore = defineStore("filter", () => {
  const isFilterModalOpen = ref<boolean>(false);
  const filterCriteria = ref<FilterCriteria>({
    text: "",
    kind: [],
    type: [],
    tags: [],
  });

  // メモ化されたフィルタリング関数
  const memoizedCardFiltering = memoizeArrayComputation(
    (cards: readonly Card[]) => {
      // カード配列全体のソート処理をメモ化
      return readonly(sortCards(cards));
    },
    { maxSize: 10, ttl: 5 * 60 * 1000 } // 5分間キャッシュ
  );

  const memoizedFilterApplication = memoizeObjectComputation(
    (params: { cards: readonly Card[]; criteria: FilterCriteria }) => {
      return applyAllFilters(params.cards, params.criteria);
    },
    { maxSize: 50, ttl: 2 * 60 * 1000 } // 2分間キャッシュ
  );

  const memoizedTagExtraction = memoizeArrayComputation(
    (cards: readonly Card[]) => {
      const tags = new Set<string>();
      for (const card of cards) {
        if (card.tags) {
          if (Array.isArray(card.tags)) {
            for (const tag of card.tags) {
              tags.add(tag);
            }
          } else if (typeof card.tags === "string") {
            tags.add(card.tags);
          }
        }
      }
      return tags;
    },
    { maxSize: 5, ttl: 10 * 60 * 1000 } // 10分間キャッシュ
  );

  /**
   * 全タグリスト（優先タグを先頭に配置）
   */
  const allTags = computed(() => {
    const cardsStore = useCardsStore();

    // メモ化されたタグ抽出を使用
    if (memoizedTagExtraction.isOk()) {
      const tags = memoizedTagExtraction.value(cardsStore.availableCards);

      const priorityTagSet = new Set(PRIORITY_TAGS);
      const otherTags = Array.from(tags)
        .filter((tag: string) => !priorityTagSet.has(tag))
        .sort();

      return readonly([
        ...PRIORITY_TAGS.filter((tag: string) => tags.has(tag)),
        ...otherTags,
      ]);
    }

    // フォールバック: メモ化に失敗した場合は従来の方法
    const tags = new Set<string>();
    for (const card of cardsStore.availableCards) {
      if (card.tags) {
        if (Array.isArray(card.tags)) {
          for (const tag of card.tags) {
            tags.add(tag);
          }
        } else if (typeof card.tags === "string") {
          tags.add(card.tags);
        }
      }
    }

    const priorityTagSet = new Set(PRIORITY_TAGS);
    const otherTags = Array.from(tags)
      .filter((tag: string) => !priorityTagSet.has(tag))
      .sort();

    return readonly([
      ...PRIORITY_TAGS.filter((tag: string) => tags.has(tag)),
      ...otherTags,
    ]);
  });

  /**
   * テキストフィルタリング（純粋関数）
   */
  const applyTextFilter = (
    cards: readonly Card[],
    text: string
  ): readonly Card[] => {
    if (!text || text.trim().length === 0) {
      return cards;
    }
    return CardDomain.searchCardsByName(cards, text);
  };

  /**
   * 種別フィルタリング（純粋関数）
   */
  const applyKindFilter = (
    cards: readonly Card[],
    kinds: readonly string[]
  ): readonly Card[] => {
    if (kinds.length === 0) {
      return cards;
    }

    return cards.filter((card) => {
      const cardKind =
        typeof card.kind === "string" ? card.kind : String(card.kind);
      return kinds.includes(cardKind);
    });
  };

  /**
   * タイプフィルタリング（純粋関数）
   */
  const applyTypeFilter = (
    cards: readonly Card[],
    types: readonly string[]
  ): readonly Card[] => {
    if (types.length === 0) {
      return cards;
    }

    return cards.filter((card) => {
      if (typeof card.type === "string") {
        return types.includes(card.type);
      } else if (Array.isArray(card.type)) {
        return card.type.some((type) => {
          const typeStr = typeof type === "string" ? type : String(type);
          return types.includes(typeStr);
        });
      } else {
        return types.includes(String(card.type));
      }
    });
  };

  /**
   * タグフィルタリング（純粋関数）
   */
  const applyTagFilter = (
    cards: readonly Card[],
    tags: readonly string[]
  ): readonly Card[] => {
    if (tags.length === 0) {
      return cards;
    }

    return cards.filter((card) => {
      if (!card.tags) return false;

      const cardTags = Array.isArray(card.tags) ? card.tags : [card.tags];
      return tags.some((tag) => cardTags.includes(tag));
    });
  };

  /**
   * 複合フィルタリング（純粋関数）
   */
  const applyAllFilters = (
    cards: readonly Card[],
    criteria: FilterCriteria
  ): readonly Card[] => {
    let filteredCards = cards;

    // テキストフィルター
    filteredCards = applyTextFilter(filteredCards, criteria.text);

    // 種別フィルター
    filteredCards = applyKindFilter(filteredCards, criteria.kind);

    // タイプフィルター
    filteredCards = applyTypeFilter(filteredCards, criteria.type);

    // タグフィルター
    filteredCards = applyTagFilter(filteredCards, criteria.tags);

    return filteredCards;
  };

  /**
   * ソート・フィルター済みカード一覧
   */
  const sortedAndFilteredCards = computed(() => {
    const cardsStore = useCardsStore();

    // メモ化されたフィルタリングを使用
    if (memoizedFilterApplication.isOk()) {
      const filtered = memoizedFilterApplication.value({
        cards: cardsStore.availableCards,
        criteria: filterCriteria.value,
      });

      // メモ化されたソートを使用
      if (memoizedCardFiltering.isOk()) {
        return memoizedCardFiltering.value(filtered);
      }
    }

    // フォールバック: メモ化に失敗した場合は従来の方法
    const filtered = applyAllFilters(
      cardsStore.availableCards,
      filterCriteria.value
    );

    return readonly(sortCards(filtered));
  });

  /**
   * フィルター結果の統計情報
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
   * フィルターが空かどうか判定
   */
  const isEmptyFilter = (criteria: FilterCriteria): boolean => {
    return (
      !criteria.text.trim() &&
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
