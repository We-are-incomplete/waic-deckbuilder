import type { Card, CardType } from "../types/card";

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

  // タグでの検索
  if (card.tags) {
    const tags = Array.isArray(card.tags) ? card.tags : [card.tags];
    return tags.some((tag: string) => tag.toLowerCase().includes(textLower));
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
    // タグが配列の場合
    return card.tags.some((tag: string) => tagSet.has(tag));
  } else if (typeof card.tags === "string") {
    // タグが文字列の場合
    return tagSet.has(card.tags);
  }

  return false;
};
