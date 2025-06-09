import type { Card, CardType } from "../types/card";
import { CARD_KINDS, CARD_TYPES } from "../constants/game";

// ソート用の型定義
export type SortComparator<T> = (a: T, b: T) => number;

/**
 * 自然順ソート関数を作成（純粋関数）
 */
export const createNaturalSort = (): SortComparator<string> => {
  return (a: string, b: string): number => {
    const regex = /(\d+)|(\D+)/g;
    const tokensA = a.match(regex);
    const tokensB = b.match(regex);

    if (!tokensA || !tokensB) return a.localeCompare(b);

    for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
      const tokenA = tokensA[i];
      const tokenB = tokensB[i];
      const numA = parseInt(tokenA, 10);
      const numB = parseInt(tokenB, 10);

      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      } else {
        const charCodeA = tokenA.charCodeAt(0);
        const charCodeB = tokenB.charCodeAt(0);
        const isUpperA = charCodeA >= 65 && charCodeA <= 90;
        const isUpperB = charCodeB >= 65 && charCodeB <= 90;

        if (isUpperA !== isUpperB) {
          return isUpperA ? -1 : 1;
        }
        if (tokenA !== tokenB) return tokenA.localeCompare(tokenB);
      }
    }

    return tokensA.length - tokensB.length;
  };
};

/**
 * カード種類別ソート関数
 */
export const createKindSort = (): SortComparator<Pick<Card, "kind">> => {
  return (a: Pick<Card, "kind">, b: Pick<Card, "kind">): number => {
    const kindA = a.kind.type;
    const kindB = b.kind.type;
    const indexA = CARD_KINDS.findIndex((kind) => kind === kindA);
    const indexB = CARD_KINDS.findIndex((kind) => kind === kindB);
    return indexA - indexB;
  };
};

/**
 * カードタイプ別ソート関数
 */
export const createTypeSort = (): SortComparator<Pick<Card, "type">> => {
  return (a: Pick<Card, "type">, b: Pick<Card, "type">): number => {
    const getEarliestTypeIndex = (
      cardTypes: CardType | readonly CardType[]
    ): number => {
      if (!cardTypes) return CARD_TYPES.length;
      const types = Array.isArray(cardTypes) ? cardTypes : [cardTypes];
      let minIndex = CARD_TYPES.length;

      for (const type of types) {
        const typeString = getTypeString(type);
        const index = CARD_TYPES.findIndex((t) => t === typeString);
        if (index !== -1 && index < minIndex) {
          minIndex = index;
        }
      }
      return minIndex;
    };

    const indexA = getEarliestTypeIndex(a.type);
    const indexB = getEarliestTypeIndex(b.type);
    return indexA - indexB;
  };
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
 * 複数のソート条件を組み合わせる高階関数
 */
export const createCombinedSort = <T>(
  ...comparators: readonly SortComparator<T>[]
): SortComparator<T> => {
  return (a: T, b: T): number => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
};

/**
 * ソート順を逆にする高階関数
 */
export const reverseSort = <T>(
  comparator: SortComparator<T>
): SortComparator<T> => {
  return (a: T, b: T): number => -comparator(a, b);
};
