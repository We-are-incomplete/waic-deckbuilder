import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types/card";
import type {
  DeckCard,
  DeckState,
  DeckOperation,
  DeckOperationError,
} from "../types/deck";

// ドメイン定数
const MAX_CARD_COPIES = 4;

// =============================================================================
// Map ベースのパフォーマンス最適化関数
// =============================================================================

// DeckCard配列をMapに変換
const createDeckCardMap = (
  cards: readonly DeckCard[]
): Map<string, DeckCard> => {
  const map = new Map<string, DeckCard>();
  for (const deckCard of cards) {
    map.set(deckCard.card.id, deckCard);
  }
  return map;
};

// MapをDeckCard配列に変換
const mapToDeckCards = (map: Map<string, DeckCard>): readonly DeckCard[] => {
  return Array.from(map.values());
};

// Mapを使用した合計カード枚数計算
const calculateTotalCardsFromMap = (map: Map<string, DeckCard>): number => {
  let sum = 0;
  for (const deckCard of map.values()) {
    sum += deckCard.count;
  }
  return sum;
};

// =============================================================================
// ヘルパー関数
// =============================================================================

// =============================================================================
// 公開API関数（既存APIとの互換性を保持）
// =============================================================================

// デッキカード作成関数
export const createDeckCard = (
  card: Card,
  count: number
): Result<DeckCard, DeckOperationError> => {
  if (count < 1) {
    return err({ type: "invalidCardCount", cardId: card.id, count });
  }
  if (count > MAX_CARD_COPIES) {
    return err({
      type: "maxCountExceeded",
      cardId: card.id,
      maxCount: MAX_CARD_COPIES,
    });
  }

  return ok({ card, count });
};

// デッキの合計カード枚数を計算
export const calculateTotalCards = (cards: readonly DeckCard[]): number => {
  const deckMap = createDeckCardMap(cards);
  return calculateTotalCardsFromMap(deckMap);
};

// デッキの状態を計算
export const calculateDeckState = (cards: readonly DeckCard[]): DeckState => {
  if (cards.length === 0) {
    return { type: "empty" };
  }

  const totalCount = calculateTotalCards(cards);
  const errors: string[] = [];

  // カード枚数のバリデーション
  for (const deckCard of cards) {
    if (deckCard.count < 1) {
      errors.push(
        `カード「${deckCard.card.name}」の枚数が無効です: ${deckCard.count}`
      );
    }
    if (deckCard.count > MAX_CARD_COPIES) {
      errors.push(
        `カード「${deckCard.card.name}」の枚数が上限を超えています: ${deckCard.count}/${MAX_CARD_COPIES}`
      );
    }
  }

  if (errors.length > 0) {
    return { type: "invalid", cards, totalCount, errors };
  }

  return { type: "valid", cards, totalCount };
};

// カードをデッキに追加（Mapベース最適化版）
export const addCardToDeck = (
  cards: readonly DeckCard[],
  cardToAdd: Card
): Result<readonly DeckCard[], DeckOperationError> => {
  const deckMap = createDeckCardMap(cards);
  const existingCard = deckMap.get(cardToAdd.id);

  if (existingCard) {
    if (existingCard.count >= MAX_CARD_COPIES) {
      return err({
        type: "maxCountExceeded",
        cardId: cardToAdd.id,
        maxCount: MAX_CARD_COPIES,
      });
    }

    const updatedCard = {
      ...existingCard,
      count: existingCard.count + 1,
    };
    deckMap.set(cardToAdd.id, updatedCard);

    return ok(mapToDeckCards(deckMap));
  } else {
    const newDeckCardResult = createDeckCard(cardToAdd, 1);
    if (newDeckCardResult.isErr()) {
      return err(newDeckCardResult.error);
    }

    deckMap.set(cardToAdd.id, newDeckCardResult.value);
    return ok(mapToDeckCards(deckMap));
  }
};

// カードの枚数を設定（Mapベース最適化版）
export const setCardCount = (
  cards: readonly DeckCard[],
  cardId: string,
  count: number
): Result<readonly DeckCard[], DeckOperationError> => {
  const deckMap = createDeckCardMap(cards);
  const existingCard = deckMap.get(cardId);

  if (!existingCard) {
    return err({ type: "cardNotFound", cardId });
  }

  if (count < 0) {
    return err({ type: "invalidCardCount", cardId, count });
  }

  if (count === 0) {
    deckMap.delete(cardId);
    return ok(mapToDeckCards(deckMap));
  }

  if (count > MAX_CARD_COPIES) {
    return err({ type: "maxCountExceeded", cardId, maxCount: MAX_CARD_COPIES });
  }

  const updatedCard = { ...existingCard, count };
  deckMap.set(cardId, updatedCard);

  return ok(mapToDeckCards(deckMap));
};

// カードをデッキから削除（Mapベース最適化版）
export const removeCardFromDeck = (
  cards: readonly DeckCard[],
  cardId: string
): Result<readonly DeckCard[], DeckOperationError> => {
  const deckMap = createDeckCardMap(cards);

  if (!deckMap.has(cardId)) {
    return err({ type: "cardNotFound", cardId });
  }

  deckMap.delete(cardId);
  return ok(mapToDeckCards(deckMap));
};

// カード枚数を増やす（Mapベース最適化版）
export const incrementCardCount = (
  cards: readonly DeckCard[],
  cardId: string
): Result<readonly DeckCard[], DeckOperationError> => {
  return setCardCount(
    cards,
    cardId,
    (cards.find((dc) => dc.card.id === cardId)?.count || 0) + 1
  );
};

// カード枚数を減らす（Mapベース最適化版）
export const decrementCardCount = (
  cards: readonly DeckCard[],
  cardId: string
): Result<readonly DeckCard[], DeckOperationError> => {
  return setCardCount(
    cards,
    cardId,
    (cards.find((dc) => dc.card.id === cardId)?.count || 0) - 1
  );
};

// デッキ操作を実行
export const executeDeckOperation = (
  cards: readonly DeckCard[],
  operation: DeckOperation
): Result<readonly DeckCard[], DeckOperationError> => {
  switch (operation.type) {
    case "addCard":
      return addCardToDeck(cards, operation.card);
    case "removeCard":
      return removeCardFromDeck(cards, operation.cardId);
    case "incrementCount":
      return incrementCardCount(cards, operation.cardId);
    case "decrementCount":
      return decrementCardCount(cards, operation.cardId);
    case "setCount":
      return setCardCount(cards, operation.cardId, operation.count);
    case "clear":
      return ok([]);
  }
};
