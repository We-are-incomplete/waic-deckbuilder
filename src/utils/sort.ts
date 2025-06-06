import type { Card, CardType } from "../types";
import { CARD_KINDS, CARD_TYPES } from "../constants";

/**
 * 自然順ソート関数を作成
 */
export const createNaturalSort = (): ((a: string, b: string) => number) => {
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
export const createKindSort = (): ((
  a: Pick<Card, "kind">,
  b: Pick<Card, "kind">
) => number) => {
  return (a: Pick<Card, "kind">, b: Pick<Card, "kind">): number => {
    const indexA = CARD_KINDS.findIndex((kind) => kind === a.kind);
    const indexB = CARD_KINDS.findIndex((kind) => kind === b.kind);
    return indexA - indexB;
  };
};

/**
 * カードタイプ別ソート関数
 */
export const createTypeSort = (): ((
  a: Pick<Card, "type">,
  b: Pick<Card, "type">
) => number) => {
  return (a: Pick<Card, "type">, b: Pick<Card, "type">): number => {
    const getEarliestTypeIndex = (
      cardTypes: CardType | readonly CardType[]
    ): number => {
      if (!cardTypes) return CARD_TYPES.length;
      const types = Array.isArray(cardTypes) ? cardTypes : [cardTypes];
      let minIndex = CARD_TYPES.length;
      for (const type of types) {
        const index = CARD_TYPES.findIndex((t) => t === type);
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
