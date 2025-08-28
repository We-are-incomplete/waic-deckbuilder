import { computed, type Ref } from "vue";
import type { DeckCard } from "../types";

/**
 * デッキカード関連の状態管理を提供するコンポーザブル
 */
export function useDeckCards(sortedDeckCards: Ref<readonly DeckCard[]>) {
  /**
   * デッキカードの総数を取得
   */
  const sortedDeckSize = computed(() => sortedDeckCards.value.length);

  return {
    deckCards: sortedDeckCards,
    sortedDeckSize,
  };
}
