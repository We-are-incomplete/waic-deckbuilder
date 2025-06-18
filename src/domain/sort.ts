import type { Card, DeckCard } from "../types";
import { createNaturalSort, createKindSort, createTypeSort } from "../utils/sort";

/**
 * @file カードとデッキカードのソートに関するドメインロジックを定義する。
 *
 * このファイルでは、カードおよびデッキカードの比較とソートを行う純粋関数を提供する。
 * - カードの種類、タイプ、IDに基づいた標準的な比較ロジック
 * - カード配列およびデッキカード配列をソートする関数
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 * - エラーハンドリングは不要なため、neverthrowは使用しない
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
  const kindComparison = kindSort({ kind: a.kind }, { kind: b.kind });
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
export const sortDeckCards = (deckCards: readonly DeckCard[]): readonly DeckCard[] => {
  const sorted = [...deckCards];
  sorted.sort(compareDeckCards);
  return sorted;
};
