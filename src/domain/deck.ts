import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types/card";
import type {
  DeckCard,
  DeckState,
  DeckOperation,
  DeckOperationError,
  DeckDetails,
} from "../types/deck";

// ドメイン定数
const MAX_CARD_COPIES = 4;
const MAX_DECK_SIZE = 60;

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
  return cards.reduce((sum, deckCard) => sum + deckCard.count, 0);
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

  // デッキサイズのバリデーション
  if (totalCount > MAX_DECK_SIZE) {
    errors.push(
      `デッキサイズが上限を超えています: ${totalCount}/${MAX_DECK_SIZE}`
    );
  }

  if (errors.length > 0) {
    return { type: "invalid", cards, totalCount, errors };
  }

  return { type: "valid", cards, totalCount };
};

// カードをデッキに追加
export const addCardToDeck = (
  cards: readonly DeckCard[],
  cardToAdd: Card
): Result<readonly DeckCard[], DeckOperationError> => {
  const existingCardIndex = cards.findIndex(
    (deckCard) => deckCard.card.id === cardToAdd.id
  );

  if (existingCardIndex >= 0) {
    const existingCard = cards[existingCardIndex];
    if (existingCard.count >= MAX_CARD_COPIES) {
      return err({
        type: "maxCountExceeded",
        cardId: cardToAdd.id,
        maxCount: MAX_CARD_COPIES,
      });
    }

    const updatedCards = [...cards];
    updatedCards[existingCardIndex] = {
      ...existingCard,
      count: existingCard.count + 1,
    };

    const totalCount = calculateTotalCards(updatedCards);
    if (totalCount > MAX_DECK_SIZE) {
      return err({
        type: "deckSizeExceeded",
        currentSize: totalCount,
        maxSize: MAX_DECK_SIZE,
      });
    }

    return ok(updatedCards);
  } else {
    const totalCount = calculateTotalCards(cards) + 1;
    if (totalCount > MAX_DECK_SIZE) {
      return err({
        type: "deckSizeExceeded",
        currentSize: totalCount,
        maxSize: MAX_DECK_SIZE,
      });
    }

    const newDeckCardResult = createDeckCard(cardToAdd, 1);
    if (newDeckCardResult.isErr()) {
      return err(newDeckCardResult.error);
    }

    return ok([...cards, newDeckCardResult.value]);
  }
};

// カードの枚数を設定
export const setCardCount = (
  cards: readonly DeckCard[],
  cardId: string,
  count: number
): Result<readonly DeckCard[], DeckOperationError> => {
  const existingCardIndex = cards.findIndex(
    (deckCard) => deckCard.card.id === cardId
  );

  if (existingCardIndex < 0) {
    return err({ type: "cardNotFound", cardId });
  }

  if (count < 0) {
    return err({ type: "invalidCardCount", cardId, count });
  }

  if (count === 0) {
    return removeCardFromDeck(cards, cardId);
  }

  if (count > MAX_CARD_COPIES) {
    return err({ type: "maxCountExceeded", cardId, maxCount: MAX_CARD_COPIES });
  }

  const updatedCards = [...cards];
  const existingCard = cards[existingCardIndex];
  updatedCards[existingCardIndex] = { ...existingCard, count };

  const totalCount = calculateTotalCards(updatedCards);
  if (totalCount > MAX_DECK_SIZE) {
    return err({
      type: "deckSizeExceeded",
      currentSize: totalCount,
      maxSize: MAX_DECK_SIZE,
    });
  }

  return ok(updatedCards);
};

// カードをデッキから削除
export const removeCardFromDeck = (
  cards: readonly DeckCard[],
  cardId: string
): Result<readonly DeckCard[], DeckOperationError> => {
  const cardExists = cards.some((deckCard) => deckCard.card.id === cardId);

  if (!cardExists) {
    return err({ type: "cardNotFound", cardId });
  }

  return ok(cards.filter((deckCard) => deckCard.card.id !== cardId));
};

// カード枚数を増やす
export const incrementCardCount = (
  cards: readonly DeckCard[],
  cardId: string
): Result<readonly DeckCard[], DeckOperationError> => {
  const existingCard = cards.find((deckCard) => deckCard.card.id === cardId);

  if (!existingCard) {
    return err({ type: "cardNotFound", cardId });
  }

  return setCardCount(cards, cardId, existingCard.count + 1);
};

// カード枚数を減らす
export const decrementCardCount = (
  cards: readonly DeckCard[],
  cardId: string
): Result<readonly DeckCard[], DeckOperationError> => {
  const existingCard = cards.find((deckCard) => deckCard.card.id === cardId);

  if (!existingCard) {
    return err({ type: "cardNotFound", cardId });
  }

  return setCardCount(cards, cardId, existingCard.count - 1);
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

// デッキ詳細を作成
export const createDeckDetails = (
  name: string,
  cards: readonly DeckCard[],
  createdAt?: Date,
  modifiedAt?: Date
): DeckDetails => {
  return {
    name,
    cards,
    totalCount: calculateTotalCards(cards),
    createdAt,
    modifiedAt: modifiedAt ?? new Date(),
  };
};
