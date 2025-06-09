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
 * カードの標準比較関数（ID → 種類 → タイプの順）
 */
export const compareCards = (a: Card, b: Card): number => {
  // IDで比較（自然順ソート）
  const idComparison = naturalSort(a.id, b.id);
  if (idComparison !== 0) return idComparison;

  // 種別で比較（CARD_KINDSの順序：Artist → Song → Magic → Direction）
  const kindComparison = kindSort({ kind: a.kind }, { kind: b.kind });
  if (kindComparison !== 0) return kindComparison;

  // タイプで比較（CARD_TYPESの順序：赤 → 青 → 黄 → 白 → 黒 → 全 → 即時 → 装備 → 設置）
  return typeSort({ type: a.type }, { type: b.type });
};

/**
 * デッキカードの標準比較関数（ID → 種類 → タイプの順）
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
