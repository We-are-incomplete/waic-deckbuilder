import { ref, computed, watch, readonly } from "vue";
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS } from "../constants";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
  removeDeckCardsFromLocalStorage,
  removeDeckNameFromLocalStorage,
  createNaturalSort,
  createKindSort,
  createTypeSort,
  createDebounce,
} from "../utils";

export function useDeck() {
  const deckCards = ref<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");

  // ヘルパー関数
  const setDeckCards = (cards: DeckCard[]) => {
    deckCards.value = cards;
  };
  const resetDeckCards = () => {
    deckCards.value = [];
    removeDeckCardsFromLocalStorage();
  };
  const resetDeckName = () => {
    deckName.value = "新しいデッキ";
    removeDeckNameFromLocalStorage();
  };

  // ソート関数インスタンス
  const naturalSort = createNaturalSort();
  const kindSort = createKindSort();
  const typeSort = createTypeSort();

  /**
   * デッキカードの比較関数
   * カード種別、タイプ、IDの順で比較する
   */
  const compareDeckCards = (a: DeckCard, b: DeckCard): number => {
    const cardA = a.card;
    const cardB = b.card;

    const kindComparison = kindSort({ kind: cardA.kind }, { kind: cardB.kind });
    if (kindComparison !== 0) return kindComparison;

    const typeComparison = typeSort({ type: cardA.type }, { type: cardB.type });
    if (typeComparison !== 0) return typeComparison;

    return naturalSort(cardA.id, cardB.id);
  };

  /**
   * ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    const sorted = [...deckCards.value];
    sorted.sort(compareDeckCards);
    return readonly(sorted);
  });

  /**
   * デッキの合計枚数
   */
  const totalDeckCards = computed(() => {
    return deckCards.value.reduce(
      (sum: number, item: DeckCard) => sum + item.count,
      0
    );
  });

  /**
   * カードをデッキに追加
   */
  const addCardToDeck = (card: Card): void => {
    if (totalDeckCards.value >= GAME_CONSTANTS.MAX_DECK_SIZE) {
      return;
    }

    const existingCardIndex = deckCards.value.findIndex(
      (item: DeckCard) => item.card.id === card.id
    );

    if (existingCardIndex > -1) {
      if (
        deckCards.value[existingCardIndex].count <
        GAME_CONSTANTS.MAX_CARD_COPIES
      ) {
        deckCards.value[existingCardIndex].count++;
      }
    } else {
      deckCards.value.push({ card: card, count: 1 });
    }
  };

  /**
   * カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): void => {
    if (totalDeckCards.value >= GAME_CONSTANTS.MAX_DECK_SIZE) {
      return;
    }
    const item = deckCards.value.find(
      (item: DeckCard) => item.card.id === cardId
    );
    if (item && item.count < GAME_CONSTANTS.MAX_CARD_COPIES) {
      item.count++;
    }
  };

  /**
   * カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): void => {
    const item = deckCards.value.find(
      (item: DeckCard) => item.card.id === cardId
    );
    if (item && item.count > 1) {
      item.count--;
    } else if (item && item.count === 1) {
      removeCardFromDeck(cardId);
    }
  };

  /**
   * カードをデッキから削除
   */
  const removeCardFromDeck = (cardId: string): void => {
    deckCards.value = deckCards.value.filter(
      (item: DeckCard) => item.card.id !== cardId
    );
  };

  /**
   * ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    deckCards.value = loadDeckFromLocalStorage(availableCards);
    deckName.value = loadDeckName();
  };

  // デッキ変更時のローカルストレージ保存（デバウンス）
  const { debouncedFunc: debouncedSaveDeck } = createDebounce(
    (newDeck: DeckCard[]) => saveDeckToLocalStorage(newDeck),
    300
  );

  watch(deckCards, debouncedSaveDeck, { deep: true });

  // デッキ名変更時のローカルストレージ保存（デバウンス）
  const { debouncedFunc: debouncedSaveDeckName } = createDebounce(
    (newName: string) => saveDeckName(newName),
    300
  );

  watch(deckName, debouncedSaveDeckName);

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    deckName.value = name;
  };

  return {
    deckCards,
    deckName,
    sortedDeckCards,
    totalDeckCards,
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    initializeDeck,
    setDeckName,
    setDeckCards, // setDeckCardsを公開
    resetDeckCards, // resetDeckCardsを公開
    resetDeckName, // resetDeckNameを公開
  };
}
