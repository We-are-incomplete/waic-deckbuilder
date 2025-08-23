import { computed } from "vue";
import type { DeckCard } from "../types";
import { globalCardListCache } from "../utils/cache";

/**
 * デッキカード関連の状態管理とメモ化を提供するコンポーザブル
 */
export function useDeckCards(sortedDeckCards: any) {
  /**
   * メモ化された計算プロパティ（不要な再レンダリングを防止）
   */
  const memoizedDeckCards = computed<readonly DeckCard[]>(() => {
    const cards = sortedDeckCards.value;
    const key = cards.map((item: DeckCard) => `${item.card.id}:${item.count}`).join(",");

    if (globalCardListCache.has(key)) {
      return globalCardListCache.get(key)!;
    }

    // キャッシュに保存
    globalCardListCache.set(key, cards);
    return cards;
  });

  /**
   * デッキカードの総数を取得
   */
  const sortedDeckCardsLength = computed(() => memoizedDeckCards.value.length);

  return {
    memoizedDeckCards,
    sortedDeckCardsLength,
  };
}
