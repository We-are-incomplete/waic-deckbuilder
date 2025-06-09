import type { Card, CardType } from "../types/card";
import type { FilterCriteria } from "../types/filter";

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

  // タグでの検索（文字列と配列の両方に対応）
  if (card.tags) {
    if (Array.isArray(card.tags)) {
      // タグが配列の場合
      return card.tags.some((tag: string) =>
        tag.toLowerCase().includes(textLower)
      );
    } else if (typeof card.tags === "string") {
      // タグが文字列の場合
      return (card.tags as string).toLowerCase().includes(textLower);
    }
  }

  return false;
};

/**
 * カードがタイプフィルターにマッチするかチェック
 */
export const isCardMatchingType = (
  card: Card,
  typeSet: Set<CardType>
): boolean => {
  const cardTypes = Array.isArray(card.type) ? card.type : [card.type];
  return cardTypes.some((type: CardType) => typeSet.has(type));
};

/**
 * カードがタイプフィルター（文字列）にマッチするかチェック
 */
export const isCardMatchingTypeString = (
  card: Card,
  typeSet: Set<string>
): boolean => {
  const cardTypes = Array.isArray(card.type) ? card.type : [card.type];
  return cardTypes.some((type: CardType) => {
    const typeString = getTypeString(type);
    return typeSet.has(typeString);
  });
};

/**
 * CardTypeから文字列表現を取得するヘルパー関数
 */
const getTypeString = (cardType: CardType): string => {
  switch (cardType.type) {
    case "color":
      return cardType.value;
    case "timing":
      return cardType.value;
    case "equipment":
      return cardType.value;
    case "installation":
      return cardType.value;
  }
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

/**
 * カードフィルター関数
 */
export const createCardFilter = (): ((
  cards: readonly Card[],
  criteria: FilterCriteria
) => Card[]) => {
  return (cards: readonly Card[], criteria: FilterCriteria): Card[] => {
    const textLower = criteria.text.toLowerCase();
    const kindSet = new Set(criteria.kind);
    const typeSet = new Set(criteria.type);
    const tagSet = new Set(criteria.tags);

    return cards.filter((card: Card) => {
      // テキスト検索
      if (textLower && !isCardMatchingText(card, textLower)) {
        return false;
      }

      // 種類フィルター
      if (kindSet.size > 0 && !kindSet.has(card.kind.type)) {
        return false;
      }

      // タイプフィルター
      if (typeSet.size > 0 && !isCardMatchingTypeString(card, typeSet)) {
        return false;
      }

      // タグフィルター
      if (tagSet.size > 0 && !isCardMatchingTag(card, tagSet)) {
        return false;
      }

      return true;
    });
  };
};
