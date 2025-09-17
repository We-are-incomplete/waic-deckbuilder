/**
 * @file デッキのドメインロジックを定義する。
 *
 * このファイルでは、デッキ内のカードの追加、削除、枚数変更、状態計算など、
 * デッキ操作に関する純粋関数を提供する。
 * - デッキカードのバリデーションと生成
 * - デッキの状態（空、有効、無効）の計算
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 * - エラーハンドリングにはEffectのEffect型を使用し、例外をスローしない
 * - パフォーマンス最適化のためにMapベースの内部処理を活用
 */
import { Effect } from "effect";
import { GAME_CONSTANTS } from "../constants";
import type { Card, DeckCard, DeckState, DeckOperation } from "../types";
import { DeckOperationError } from "../types/deck"; // 更新されたDeckOperationErrorをインポート

// =============================================================================
// Map ベースのパフォーマンス最適化関数
// =============================================================================

// DeckCard配列をMapに変換
const createDeckCardMap = (
  cards: readonly DeckCard[],
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

// =============================================================================
// ヘルパー関数
// =============================================================================

// =============================================================================
// 公開API関数（既存APIとの互換性を保持）
// =============================================================================

// デッキカード作成関数
export const createDeckCard = (
  card: Card,
  count: number,
): Effect.Effect<DeckCard, DeckOperationError> => {
  if (count < 1) {
    return Effect.fail(
      new DeckOperationError({ type: "InvalidCardCount", cardId: card.id, count }),
    );
  }
  if (count > GAME_CONSTANTS.MAX_CARD_COPIES) {
    return Effect.fail(
      new DeckOperationError({
        type: "MaxCountExceeded",
        cardId: card.id,
        maxCount: GAME_CONSTANTS.MAX_CARD_COPIES,
      }),
    );
  }

  return Effect.succeed({ card, count });
};

export const calculateTotalCards = (cards: readonly DeckCard[]): number => {
  return cards.reduce((sum, c) => sum + c.count, 0);
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
        `カード「${deckCard.card.name}」の枚数が無効です: ${deckCard.count}`,
      );
    }
    if (deckCard.count > GAME_CONSTANTS.MAX_CARD_COPIES) {
      errors.push(
        `カード「${deckCard.card.name}」の枚数が上限を超えています: ${deckCard.count}/${GAME_CONSTANTS.MAX_CARD_COPIES}`,
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
  cardToAdd: Card,
): Effect.Effect<readonly DeckCard[], DeckOperationError> => {
  const deckMap = createDeckCardMap(cards);
  const existingCard = deckMap.get(cardToAdd.id);

  if (existingCard) {
    if (existingCard.count >= GAME_CONSTANTS.MAX_CARD_COPIES) {
      return Effect.fail(
        new DeckOperationError({
          type: "MaxCountExceeded",
          cardId: cardToAdd.id,
          maxCount: GAME_CONSTANTS.MAX_CARD_COPIES,
        }),
      );
    }

    const updatedCard = {
      ...existingCard,
      count: existingCard.count + 1,
    };
    deckMap.set(cardToAdd.id, updatedCard);

    return Effect.succeed(mapToDeckCards(deckMap));
  } else {
    return Effect.gen(function* () {
      const newDeckCard = yield* createDeckCard(cardToAdd, 1);
      deckMap.set(cardToAdd.id, newDeckCard);
      return mapToDeckCards(deckMap);
    });
  }
};

// カードの枚数を設定（Mapベース最適化版）
export const setCardCount = (
  cards: readonly DeckCard[],
  cardId: string,
  count: number,
): Effect.Effect<readonly DeckCard[], DeckOperationError> => {
  const deckMap = createDeckCardMap(cards);
  const existingCard = deckMap.get(cardId);

  if (!existingCard) {
    return Effect.fail(new DeckOperationError({ type: "CardNotFound", cardId }));
  }

  if (count < 0) {
    return Effect.fail(
      new DeckOperationError({ type: "InvalidCardCount", cardId, count }),
    );
  }

  if (count === 0) {
    deckMap.delete(cardId);
    return Effect.succeed(mapToDeckCards(deckMap));
  }

  if (count > GAME_CONSTANTS.MAX_CARD_COPIES) {
    return Effect.fail(
      new DeckOperationError({
        type: "MaxCountExceeded",
        cardId,
        maxCount: GAME_CONSTANTS.MAX_CARD_COPIES,
      }),
    );
  }

  const updatedCard = { ...existingCard, count };
  deckMap.set(cardId, updatedCard);

  return Effect.succeed(mapToDeckCards(deckMap));
};

// カードをデッキから削除（Mapベース最適化版）
export const removeCardFromDeck = (
  cards: readonly DeckCard[],
  cardId: string,
): Effect.Effect<readonly DeckCard[], DeckOperationError> => {
  const deckMap = createDeckCardMap(cards);

  if (!deckMap.has(cardId)) {
    return Effect.fail(new DeckOperationError({ type: "CardNotFound", cardId }));
  }

  deckMap.delete(cardId);
  return Effect.succeed(mapToDeckCards(deckMap));
};

// カード枚数を増やす（Mapベース最適化版）
export const incrementCardCount = (
  cards: readonly DeckCard[],
  cardId: string,
): Effect.Effect<readonly DeckCard[], DeckOperationError> => {
  const current = cards.find((dc) => dc.card.id === cardId)?.count ?? 0;
  return setCardCount(cards, cardId, current + 1);
};

// カード枚数を減らす（Mapベース最適化版）
export const decrementCardCount = (
  cards: readonly DeckCard[],
  cardId: string,
): Effect.Effect<readonly DeckCard[], DeckOperationError> => {
  const current = cards.find((dc) => dc.card.id === cardId)?.count ?? 0;
  return setCardCount(cards, cardId, current - 1);
};

// デッキ操作を実行
export const executeDeckOperation = (
  cards: readonly DeckCard[],
  operation: DeckOperation,
): Effect.Effect<readonly DeckCard[], DeckOperationError> => {
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
      return Effect.succeed([]);
  }
};
