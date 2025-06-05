import { ref, computed, watch, readonly } from "vue";
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS, STORAGE_KEYS } from "../constants";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
} from "../utils/storage";
import { encodeDeckCode, decodeDeckCode } from "../utils/deckCode";
import {
  createNaturalSort,
  createKindSort,
  createTypeSort,
} from "../utils/sort";

export function useDeck() {
  const deckCards = ref<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");
  const deckCode = ref<string>("");
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);

  // ソート関数インスタンス
  const naturalSort = createNaturalSort();
  const kindSort = createKindSort();
  const typeSort = createTypeSort();

  /**
   * ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    const sorted = [...deckCards.value];

    sorted.sort((a: DeckCard, b: DeckCard) => {
      const cardA = a.card;
      const cardB = b.card;

      const kindComparison = kindSort(
        { kind: cardA.kind },
        { kind: cardB.kind }
      );
      if (kindComparison !== 0) return kindComparison;

      const typeComparison = typeSort(
        { type: cardA.type },
        { type: cardB.type }
      );
      if (typeComparison !== 0) return typeComparison;

      return naturalSort(cardA.id, cardB.id);
    });

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
   * デッキをリセット
   */
  const resetDeck = (): void => {
    if (confirm("デッキ内容を全てリセットしてもよろしいですか？")) {
      deckCards.value = [];
      deckName.value = "新しいデッキ";
      localStorage.removeItem(STORAGE_KEYS.DECK_CARDS);
      localStorage.removeItem(STORAGE_KEYS.DECK_NAME);
    }
  };

  /**
   * デッキコードを生成・表示
   */
  const generateAndShowDeckCode = (): void => {
    isGeneratingCode.value = true;
    try {
      deckCode.value = encodeDeckCode(deckCards.value);
      showDeckCodeModal.value = true;
    } catch (e) {
      console.error("デッキコードの生成に失敗しました:", e);
    } finally {
      isGeneratingCode.value = false;
    }
  };

  /**
   * デッキコードをクリップボードにコピー
   */
  const copyDeckCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(deckCode.value);
      console.log("デッキコードをコピーしました");
    } catch {
      console.error("デッキコードのコピーに失敗しました");
    }
  };

  /**
   * デッキコードからインポート
   */
  const importDeckFromCode = (availableCards: readonly Card[]): void => {
    try {
      const importedCards = decodeDeckCode(
        importDeckCode.value,
        availableCards
      );
      if (importedCards.length > 0) {
        deckCards.value = importedCards;
        importDeckCode.value = "";
        showDeckCodeModal.value = false;
      } else {
        console.warn("有効なカードが見つかりませんでした");
      }
    } catch (e) {
      console.error("デッキコードの復元に失敗しました:", e);
    }
  };

  /**
   * ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    deckCards.value = loadDeckFromLocalStorage(availableCards);
    deckName.value = loadDeckName();
  };

  // デッキ変更時のローカルストレージ保存
  watch(
    deckCards,
    (newDeck: DeckCard[]) => {
      saveDeckToLocalStorage(newDeck);
    },
    { deep: true }
  );

  // デッキ名変更時のローカルストレージ保存
  watch(deckName, (newName: string) => {
    saveDeckName(newName);
  });

  return {
    deckCards,
    deckName,
    deckCode,
    importDeckCode,
    isGeneratingCode,
    showDeckCodeModal,
    sortedDeckCards,
    totalDeckCards,
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    resetDeck,
    generateAndShowDeckCode,
    copyDeckCode,
    importDeckFromCode,
    initializeDeck,
  };
}
