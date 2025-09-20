/**
 * ソートユーティリティ
 * - 自然順/種別/タイプの比較関数群
 * - 純粋関数のみ（副作用なし）
 */
import type { Card, CardType } from "../types";
import { CARD_KINDS, CARD_TYPES } from "../constants";

// ソート用の型定義
export type SortComparator<T> = (a: T, b: T) => number;

/**
 * 自然順ソート関数を作成（純粋関数）
 */
export const createNaturalSort = (): SortComparator<string> => {
  const collator = new Intl.Collator("ja", {
    numeric: true,
    sensitivity: "base",
  });
  return (a: string, b: string): number => collator.compare(a, b);
};

/**
 * カード種類別ソート関数（CARD_KINDSの並び順に従う）
 * Artist → Song → Magic → Direction の順序
 */
export const createKindSort = (): SortComparator<Pick<Card, "kind">> => {
  return (a: Pick<Card, "kind">, b: Pick<Card, "kind">): number => {
    // kindプロパティの型に応じて文字列を取得
    const kindA = a.kind;
    const kindB = b.kind;

    // CARD_KINDSは ["Artist", "Song", "Magic", "Direction"] の順序
    const indexA = CARD_KINDS.indexOf(kindA);
    const indexB = CARD_KINDS.indexOf(kindB);

    // 見つからない場合は最後に配置
    const finalIndexA = indexA === -1 ? CARD_KINDS.length : indexA;
    const finalIndexB = indexB === -1 ? CARD_KINDS.length : indexB;

    return finalIndexA - finalIndexB;
  };
};

/**
 * カードタイプ別ソート関数（CARD_TYPESの並び順に従う）
 * 赤 → 青 → 黄 → 白 → 黒 → 全 → 即時 → 装備 → 設置 の順序
 */
const TYPE_INDEX: ReadonlyMap<CardType, number> = new Map(
  CARD_TYPES.map((t, i) => [t, i] as const),
);

export const createTypeSort = (): SortComparator<Pick<Card, "type">> => {
  const getEarliestTypeIndex = (
    cardTypes: CardType | readonly CardType[],
  ): number => {
    const types: readonly CardType[] = Array.isArray(cardTypes)
      ? cardTypes
      : [cardTypes];
    let minIndex: number = CARD_TYPES.length;
    for (const type of types) {
      // CARD_TYPESは ["赤", "青", "黄", "白", "黒", "全", "即時", "装備", "設置"] の順序
      const index = TYPE_INDEX.get(type) ?? CARD_TYPES.length;
      if (index < minIndex) {
        minIndex = index;
      }
    }
    return minIndex;
  };

  return (a: Pick<Card, "type">, b: Pick<Card, "type">): number => {
    const indexA = getEarliestTypeIndex(a.type);
    const indexB = getEarliestTypeIndex(b.type);
    return indexA - indexB;
  };
};
