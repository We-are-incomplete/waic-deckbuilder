/**
 * フィルタユーティリティ
 * - テキスト/タイプ/タグ一致判定の純粋関数群（副作用なし）
 */
import type { Card, CardType } from "../types";

/**
 * カードがテキスト検索にマッチするかチェック
 */
export const isCardMatchingText = (card: Card, textLower: string): boolean => {
  // 名前とIDでの検索
  if (
    card.name.toLowerCase().includes(textLower) ||
    card.id.toLowerCase().includes(textLower)
  ) {
    return true;
  }

  // タグでの検索（tags は配列前提）
  if (Array.isArray(card.tags)) {
    return card.tags.some((tag) => tag.toLowerCase().includes(textLower));
  }

  return false;
};

/**
 * カードがタイプフィルターにマッチするかチェック
 */
export const isCardMatchingType = (
  card: Card,
  typeSet: Set<CardType>,
): boolean => {
  return card.type.some((t) => typeSet.has(t));
};

/**
 * カードがタグフィルターにマッチするかチェック
 */
export const isCardMatchingTag = (card: Card, tagSet: Set<string>): boolean => {
  if (!card.tags) {
    return false;
  }

  if (Array.isArray(card.tags)) {
    return card.tags.some((tag) => tagSet.has(tag));
  }

  return false;
};
