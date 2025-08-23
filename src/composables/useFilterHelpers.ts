import { computed, type ComputedRef } from "vue";
import type { FilterCriteria } from "../types";

/**
 * フィルター選択状態のヘルパー関数を提供するコンポーザブル
 */
export function useFilterHelpers(filterCriteria: ComputedRef<FilterCriteria>) {
  /**
   * 指定された種類が選択されているかチェック
   */
  const isKindSelected = (kind: string): boolean => {
    return filterCriteria.value.kind.includes(kind);
  };

  /**
   * 指定された型が選択されているかチェック
   */
  const isTypeSelected = (type: string): boolean => {
    return filterCriteria.value.type.includes(type);
  };

  /**
   * 指定されたタグが選択されているかチェック
   */
  const isTagSelected = (tag: string): boolean => {
    return filterCriteria.value.tags.includes(tag);
  };

  /**
   * フィルターの総数（アクティブなフィルターの個数）
   */
  const activeFiltersCount = computed(() => {
    const criteria = filterCriteria.value;
    let count = 0;
    
    if (criteria.text?.trim()) count++;
    count += criteria.kind.length;
    count += criteria.type.length;
    count += criteria.tags.length;
    
    return count;
  });

  /**
   * フィルターが空かどうか
   */
  const isFilterEmpty = computed(() => {
    return activeFiltersCount.value === 0;
  });

  return {
    isKindSelected,
    isTypeSelected,
    isTagSelected,
    activeFiltersCount,
    isFilterEmpty,
  };
}
