/**
 * @file カードのフィルタリングに関するドメインロジックを定義する。
 *
 * このファイルでは、様々な条件に基づいてカードのリストをフィルタリングする純粋関数を提供する。
 * - テキスト検索、カード種別、カードタイプ、タグによるフィルタリングをサポート
 * - 複数のフィルター条件を組み合わせる複合フィルター機能
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 * - エラーハンドリングは不要なため、neverthrowは使用しない
 */
import type { Card } from "../types/card";
import type { FilterCondition } from "../types/filter";
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
      return condition.conditions.reduce((filteredCards, subCondition) => {
        return applyFilter(filteredCards, subCondition);
      }, cards);
  }
};

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
