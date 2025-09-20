/**
 * @file カードのドメインロジックを定義する。
 *
 * このファイルでは、カードの作成、検索、フィルタリングに関する純粋関数を提供する。
 * - カードのバリデーションと生成
 * - カード名、種別、タイプ、タグによるフィルタリング
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
