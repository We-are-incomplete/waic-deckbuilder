import type { Card } from "../types/card";
import type { FilterCondition, FilterResult } from "../types/filter";
import {
  searchCardsByName,
  filterCardsByKind,
  filterCardsByType,
  filterCardsByTags,
} from "./card";

// フィルター条件を適用する純粋関数
export const applyFilter = (
  cards: readonly Card[],
  condition: FilterCondition
): readonly Card[] => {
  switch (condition.type) {
    case "text":
      return searchCardsByName(cards, condition.value);

    case "kind":
      return filterCardsByKind(cards, condition.values);

    case "cardType":
      return filterCardsByType(cards, condition.values);

    case "tags":
      return filterCardsByTags(cards, condition.values);

    case "combined":
      return condition.conditions.reduce(
        (filteredCards, subCondition) =>
          applyFilter(filteredCards, subCondition),
        cards
      );
  }
};

// フィルター結果を作成する純粋関数
export const createFilterResult = <T>(
  allItems: readonly T[],
  filteredItems: readonly T[]
): FilterResult<T> => ({
  items: filteredItems,
  totalCount: allItems.length,
  filteredCount: filteredItems.length,
});

// 複数のフィルター条件を組み合わせる
export const combineFilters = (
  conditions: readonly FilterCondition[]
): FilterCondition => ({
  type: "combined",
  conditions,
});

// テキストフィルター条件を作成
export const createTextFilter = (text: string): FilterCondition => ({
  type: "text",
  value: text,
});

// 種別フィルター条件を作成
export const createKindFilter = (
  kinds: readonly import("../types/card").CardKind[]
): FilterCondition => ({
  type: "kind",
  values: kinds,
});

// タイプフィルター条件を作成
export const createTypeFilter = (
  types: readonly import("../types/card").CardType[]
): FilterCondition => ({
  type: "cardType",
  values: types,
});

// タグフィルター条件を作成
export const createTagFilter = (tags: readonly string[]): FilterCondition => ({
  type: "tags",
  values: tags,
});

// フィルター条件が空かどうかをチェック
export const isEmptyFilter = (condition: FilterCondition): boolean => {
  switch (condition.type) {
    case "text":
      return !condition.value || condition.value.trim().length === 0;

    case "kind":
    case "cardType":
    case "tags":
      return condition.values.length === 0;

    case "combined":
      return (
        condition.conditions.length === 0 ||
        condition.conditions.every(isEmptyFilter)
      );
  }
};

// カードにフィルター条件が適用できるかチェック
export const canApplyFilter = (
  cards: readonly Card[],
  condition: FilterCondition
): boolean => {
  if (cards.length === 0) return false;
  return !isEmptyFilter(condition);
};
