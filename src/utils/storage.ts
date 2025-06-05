import type { Card, DeckCard } from "../types";
import { STORAGE_KEYS } from "../constants";

/**
 * エラーハンドリング関数
 */
const handleError = (error: unknown, message: string): void => {
  console.error(message, error);
};

/**
 * デッキをローカルストレージに保存
 */
export const saveDeckToLocalStorage = (deck: readonly DeckCard[]): void => {
  try {
    const simpleDeck = deck.map((item: DeckCard) => ({
      id: item.card.id,
      count: item.count,
    }));
    localStorage.setItem(STORAGE_KEYS.DECK_CARDS, JSON.stringify(simpleDeck));
  } catch (e) {
    handleError(e, "デッキの保存に失敗しました");
  }
};

/**
 * ローカルストレージからデッキを読み込み
 */
export const loadDeckFromLocalStorage = (
  availableCards: readonly Card[]
): DeckCard[] => {
  try {
    const savedDeck = localStorage.getItem(STORAGE_KEYS.DECK_CARDS);
    if (!savedDeck) return [];

    const simpleDeck: { id: string; count: number }[] = JSON.parse(savedDeck);
    return simpleDeck
      .map((item: { id: string; count: number }) => {
        const card = availableCards.find((c: Card) => c.id === item.id);
        return card ? { card: card, count: item.count } : null;
      })
      .filter((item: DeckCard | null): item is DeckCard => item !== null);
  } catch (e) {
    handleError(e, "保存されたデッキの読み込みに失敗しました");
    localStorage.removeItem(STORAGE_KEYS.DECK_CARDS);
    localStorage.removeItem(STORAGE_KEYS.DECK_NAME);
    return [];
  }
};

/**
 * デッキ名をローカルストレージに保存
 */
export const saveDeckName = (name: string): void => {
  localStorage.setItem(STORAGE_KEYS.DECK_NAME, name);
};

/**
 * ローカルストレージからデッキ名を読み込み
 */
export const loadDeckName = (): string => {
  return localStorage.getItem(STORAGE_KEYS.DECK_NAME) || "新しいデッキ";
};
