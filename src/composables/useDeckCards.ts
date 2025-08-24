import { computed, type Ref } from "vue";
import type { DeckCard } from "../types/deck";

/**
 * デッキカード関連の状態管理を提供するコンポーザブル
 */
export function useDeckCards(sortedDeckCards: Ref<readonly DeckCard[]>) {
  /**
   * デッキカードの総数を取得
   */
  const sortedDeckCardsLength = computed(() => sortedDeckCards.value.length);

  return {
    deckCards: sortedDeckCards,
    sortedDeckCardsLength,
  };
}
