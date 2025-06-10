import type { Card, DeckCard } from "../types";
import {
  createNaturalSort,
  createKindSort,
  createTypeSort,
} from "../utils/sort";

/**
 * ソート処理のドメインロジック
 * カードとデッキカードのソートを統一的に管理
 */

// ソート関数インスタンス（シングルトン）
const naturalSort = createNaturalSort();
const kindSort = createKindSort();
const typeSort = createTypeSort();

/**
 * カードの標準比較関数（種類 → タイプ → IDの順）
 */
export const compareCards = (a: Card, b: Card): number => {
  // 実際のカードデータ形式に対応した比較
  // 種別で比較（CARD_KINDSの順序：Artist → Song → Magic → Direction）
  const kindA = typeof a.kind === "string" ? a.kind : a.kind.type;
  const kindB = typeof b.kind === "string" ? b.kind : b.kind.type;
  const kindComparison = kindSort(
    { kind: { type: kindA } },
    { kind: { type: kindB } }
  );
  if (kindComparison !== 0) return kindComparison;

  // タイプで比較（CARD_TYPESの順序：赤 → 青 → 黄 → 白 → 黒 → 全 → 即時 → 装備 → 設置）
  const typeComparison = typeSort({ type: a.type }, { type: b.type });
  if (typeComparison !== 0) return typeComparison;

  // IDで比較（自然順ソート）
  return naturalSort(a.id, b.id);
};

/**
 * デッキカードの標準比較関数（種類 → タイプ → IDの順）
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
  deckCards: readonly DeckCard[]
): readonly DeckCard[] => {
  const sorted = [...deckCards];
  sorted.sort(compareDeckCards);
  return sorted;
};

/**
 * カード配列の破壊的ソート（パフォーマンス重視の場合）
 */
export const sortCardsMutating = (cards: Card[]): Card[] => {
  cards.sort(compareCards);
  return cards;
};

/**
 * デッキカード配列の破壊的ソート（パフォーマンス重視の場合）
 */
export const sortDeckCardsMutating = (deckCards: DeckCard[]): DeckCard[] => {
  deckCards.sort(compareDeckCards);
  return deckCards;
};
