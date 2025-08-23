import { computed } from "vue";

/**
 * デッキカード関連の状態管理を提供するコンポーザブル
 */
export function useDeckCards(sortedDeckCards: any) {
  /**
   * デッキカードの総数を取得
   */
  const sortedDeckCardsLength = computed(() => sortedDeckCards.value.length);

  return {
    memoizedDeckCards: sortedDeckCards,
    sortedDeckCardsLength,
  };
}
