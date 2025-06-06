import type { Card, DeckCard } from "../types";

/**
 * デッキコードをエンコード
 */
export const encodeDeckCode = (deck: readonly DeckCard[]): string => {
  const cardIds = deck.flatMap((item: DeckCard) =>
    Array(item.count).fill(item.card.id)
  );
  return cardIds.join("/");
};

/**
 * デッキコードをデコード
 */
export const decodeDeckCode = (
  code: string,
  availableCards: readonly Card[]
): DeckCard[] => {
  const cardIds = code.split("/");
  const cardCounts = new Map<string, number>();

  for (const id of cardIds) {
    cardCounts.set(id, (cardCounts.get(id) || 0) + 1);
  }

  const cards: DeckCard[] = [];
  for (const [id, count] of cardCounts) {
    const card = availableCards.find((c: Card) => c.id === id);
    if (card) {
      cards.push({ card, count });
    }
  }

  return cards;
};
