import type { Card, FilterCriteria, CardType } from "../types";

/**
 * カードがテキスト検索にマッチするかチェック
 */
export const isCardMatchingText = (card: Card, textLower: string): boolean => {
  return (
    card.name.toLowerCase().includes(textLower) ||
    card.id.toLowerCase().includes(textLower) ||
    (card.tags?.some((tag: string) => tag.toLowerCase().includes(textLower)) ??
      false)
  );
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
 * カードがタグフィルターにマッチするかチェック
 */
export const isCardMatchingTag = (card: Card, tagSet: Set<string>): boolean => {
  return card.tags?.some((tag: string) => tagSet.has(tag)) ?? false;
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
      if (kindSet.size > 0 && !kindSet.has(card.kind)) {
        return false;
      }

      // タイプフィルター
      if (typeSet.size > 0 && !isCardMatchingType(card, typeSet)) {
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
