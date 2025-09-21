/**
 * @file カードのドメインロジックを定義する。
 *
 * このファイルでは、カード名/ID による検索の純粋関数のみを提供する。
 * - フィルタリング/生成の責務は他モジュールへ委譲済み
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 */
import type { Card } from "../types";

// カード名による検索
export const searchCardsByName = (
  cards: readonly Card[],
  searchText: string,
): readonly Card[] => {
  if (!searchText || searchText.trim().length === 0) {
    return cards;
  }

  const normalizedSearchText = searchText.trim().toLowerCase();
  return cards.filter(
    (card) =>
      card.name.toLowerCase().includes(normalizedSearchText) ||
      card.id.toLowerCase().includes(normalizedSearchText),
  );
};
