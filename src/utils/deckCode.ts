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
  // 空文字列の場合は早期リターン
  if (!code || code.trim() === "") {
    console.log("デッキコードが空です");
    return [];
  }

  const cardIds = code.split("/").filter((id) => id.trim() !== ""); // 空文字列を除外
  console.log("分割されたカードID:", cardIds);

  const cardCounts = new Map<string, number>();

  for (const id of cardIds) {
    const trimmedId = id.trim();
    if (trimmedId) {
      cardCounts.set(trimmedId, (cardCounts.get(trimmedId) || 0) + 1);
    }
  }

  console.log("カードID別枚数:", Object.fromEntries(cardCounts));

  const cards: DeckCard[] = [];
  let foundCount = 0;
  let notFoundIds: string[] = [];

  for (const [id, count] of cardCounts) {
    const card = availableCards.find((c: Card) => c.id === id);
    if (card) {
      cards.push({ card, count });
      foundCount++;
    } else {
      notFoundIds.push(id);
    }
  }

  console.log(`見つかったカード: ${foundCount}/${cardCounts.size}`);
  if (notFoundIds.length > 0) {
    console.warn("見つからなかったカードID:", notFoundIds);
  }

  return cards;
};
