import type { Card, DeckCard, CardType } from "../types";
import { CARD_KINDS, CARD_TYPES } from "../constants";

/**
 * @file カードとデッキカードのソートに関するドメインロジックを定義する。
 *
 * このファイルでは、カードおよびデッキカードの比較とソートを行う純粋関数を提供する。
 * - カードの種類、タイプ、IDに基づいた標準的な比較ロジック
 * - カード配列およびデッキカード配列をソートする関数
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 */

// --- 内蔵ソート実装（utils/sort の重複を排除） ---
export type SortComparator<T> = (a: T, b: T) => number;

const createNaturalSort = (): SortComparator<string> => {
  const collator = new Intl.Collator("ja", {
    numeric: true,
    sensitivity: "base",
  });
  return (a: string, b: string): number => collator.compare(a, b);
};

const createKindSort = (): SortComparator<Pick<Card, "kind">> => {
  return (a: Pick<Card, "kind">, b: Pick<Card, "kind">): number => {
    const indexA = KIND_INDEX.get(a.kind) ?? CARD_KINDS.length;
    const indexB = KIND_INDEX.get(b.kind) ?? CARD_KINDS.length;
    return indexA - indexB;
  };
};

const KIND_INDEX: ReadonlyMap<Card["kind"], number> = new Map(
  CARD_KINDS.map((k, i) => [k, i] as const),
);

const TYPE_INDEX: ReadonlyMap<CardType, number> = new Map(
  CARD_TYPES.map((t, i) => [t, i] as const),
);

const getEarliestTypeIndex = (
  cardTypes: CardType | readonly CardType[],
): number => {
  const types: readonly CardType[] = Array.isArray(cardTypes)
    ? cardTypes
    : [cardTypes];
  let minIndex: number = CARD_TYPES.length;
  for (const type of types) {
    const index = TYPE_INDEX.get(type) ?? CARD_TYPES.length;
    if (index < minIndex) minIndex = index;
  }
  return minIndex;
};

const createTypeSort = (): SortComparator<Pick<Card, "type">> => {
  return (a: Pick<Card, "type">, b: Pick<Card, "type">): number => {
    const indexA = getEarliestTypeIndex(a.type);
    const indexB = getEarliestTypeIndex(b.type);
    return indexA - indexB;
  };
};

// ソート関数インスタンス（シングルトン）
const naturalSort = createNaturalSort();
const kindSort = createKindSort();
const typeSort = createTypeSort();

// ex/prm で始まるID検出用（大文字小文字無視）
const EX_PRM_ID_RE = /^(?:ex|prm)/i;

/**
 * カードの標準比較関数（種類 → タイプ → ex/prm 末尾ルール → IDの順）
 */
export const compareCards = (a: Card, b: Card): number => {
  // 実際のカードデータ形式に対応した比較
  // 種別で比較（CARD_KINDSの順序：Artist → Song → Magic → Direction）
  const kindComparison = kindSort({ kind: a.kind }, { kind: b.kind });
  if (kindComparison !== 0) return kindComparison;

  // タイプで比較（CARD_TYPESの順序：赤 → 青 → 黄 → 白 → 黒 → 全 → 即時 → 装備 → 設置）
  const typeComparison = typeSort({ type: a.type }, { type: b.type });
  if (typeComparison !== 0) return typeComparison;

  // ex/prm で始まるIDは末尾へ
  const aExPrm = EX_PRM_ID_RE.test(a.id);
  const bExPrm = EX_PRM_ID_RE.test(b.id);
  if (aExPrm !== bExPrm) return aExPrm ? 1 : -1;

  // IDで比較（ex/prm 末尾ルール適用後、自然順ソート）
  return naturalSort(a.id, b.id);
};

/**
 * デッキカードの標準比較関数
 */
export const compareDeckCards = (a: DeckCard, b: DeckCard): number => {
  return compareCards(a.card, b.card);
};

/**
 * カード配列をソートする純粋関数
 */
export const sortCards = (cards: readonly Card[]): readonly Card[] => {
  const sorted = [...cards];
  sorted.sort(compareCards);
  return sorted;
};

/**
 * デッキカード配列をソートする純粋関数
 */
export const sortDeckCards = (
  deckCards: readonly DeckCard[],
): readonly DeckCard[] => {
  const sorted = [...deckCards];
  sorted.sort(compareDeckCards);
  return sorted;
};
