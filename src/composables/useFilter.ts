import { ref, readonly } from "vue";
import type { Card } from "../types/card";
import type { FilterCriteria } from "../types/filter";
import { CARD_KINDS, CARD_TYPES, PRIORITY_TAGS } from "../constants/game";
import { createCardFilter } from "../utils/filter";
import {
  createNaturalSort,
  createKindSort,
  createTypeSort,
} from "../utils/sort";

export function useFilter() {
  const isFilterModalOpen = ref<boolean>(false);
  const filterCriteria = ref<FilterCriteria>({
    text: "",
    kind: [],
    type: [],
    tags: [],
  });

  // フィルター関数インスタンス
  const cardFilter = createCardFilter();

  // ソート関数インスタンス
  const naturalSort = createNaturalSort();
  const kindSort = createKindSort();
  const typeSort = createTypeSort();

  /**
   * 全タグリスト（優先タグを先頭に配置）
   */
  const getAllTags = (availableCards: readonly Card[]): readonly string[] => {
    const tags = new Set<string>();
    for (const card of availableCards) {
      if (card.tags) {
        if (Array.isArray(card.tags)) {
          // タグが配列の場合
          for (const tag of card.tags) {
            tags.add(tag);
          }
        } else if (typeof card.tags === "string") {
          // タグが文字列の場合
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
  };

  /**
   * ソート・フィルター済みカード一覧を取得
   */
  const getSortedAndFilteredCards = (
    availableCards: readonly Card[]
  ): readonly Card[] => {
    const filtered = cardFilter(availableCards, filterCriteria.value);
    const sorted = [...filtered];

    sorted.sort((a: Card, b: Card) => {
      const kindComparison = kindSort(a, b);
      if (kindComparison !== 0) return kindComparison;

      const typeComparison = typeSort(a, b);
      if (typeComparison !== 0) return typeComparison;

      return naturalSort(a.id, b.id);
    });

    return readonly(sorted);
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
    filterCriteria.value = criteria;
  };

  return {
    isFilterModalOpen,
    filterCriteria,
    getAllTags,
    getSortedAndFilteredCards,
    openFilterModal,
    closeFilterModal,
    updateFilterCriteria,
    allKinds: readonly([...CARD_KINDS]),
    allTypes: readonly([...CARD_TYPES]),
  };
}
