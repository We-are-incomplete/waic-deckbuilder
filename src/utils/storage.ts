import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { STORAGE_KEYS } from "../constants/storage";
import { logger } from "./logger"; // loggerをインポート

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
    logger.error("デッキの保存に失敗しました", e);
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
    logger.error("保存されたデッキの読み込みに失敗しました", e);
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

/**
 * デッキカードをローカルストレージから削除
 */
export const removeDeckCardsFromLocalStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DECK_CARDS);
  } catch (e) {
    logger.error("デッキカードの削除に失敗しました", e);
  }
};

/**
 * デッキ名をローカルストレージから削除
 */
export const removeDeckNameFromLocalStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DECK_NAME);
  } catch (e) {
    logger.error("デッキ名の削除に失敗しました", e);
  }
};
