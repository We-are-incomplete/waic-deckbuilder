import { ok, err, type Result } from "neverthrow";
import { fromThrowable } from "neverthrow";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { STORAGE_KEYS } from "../constants/storage";
import { logger } from "./logger"; // loggerをインポート

// ストレージ操作エラー型
export type StorageError =
  | { readonly type: "notFound"; readonly key: string }
  | { readonly type: "parseError"; readonly key: string; readonly data: string }
  | { readonly type: "saveError"; readonly key: string; readonly data: unknown }
  | { readonly type: "removeError"; readonly key: string }
  | {
      readonly type: "invalidData";
      readonly key: string;
      readonly reason: string;
    };

// 純粋関数：デッキカードをシリアライズ可能な形式に変換
export const serializeDeckCards = (
  deck: readonly DeckCard[]
): readonly { id: string; count: number }[] => {
  return deck.map((item: DeckCard) => ({
    id: item.card.id,
    count: item.count,
  }));
};

// 純粋関数：シリアライズされたデータをデッキカードに復元
export const deserializeDeckCards = (
  serializedDeck: readonly { id: string; count: number }[],
  availableCards: readonly Card[]
): DeckCard[] => {
  // availableCardsをMapに変換して高速ルックアップを可能にする
  const availableCardsMap = new Map<string, Card>();
  for (const card of availableCards) {
    availableCardsMap.set(card.id, card);
  }

  return serializedDeck
    .map((item: { id: string; count: number }) => {
      const card = availableCardsMap.get(item.id);
      return card ? { card: card, count: item.count } : null;
    })
    .filter((item: DeckCard | null): item is DeckCard => item !== null);
};

// IO操作：ローカルストレージから文字列を取得
const getFromLocalStorage = fromThrowable(
  (key: string): string | null => {
    return localStorage.getItem(key);
  },
  (error: unknown) => ({ type: "getError" as const, key: "unknown", error })
);

// IO操作：ローカルストレージに文字列を保存
const setToLocalStorage = fromThrowable(
  (key: string, value: string): void => {
    localStorage.setItem(key, value);
  },
  (error: unknown) => ({ type: "setError" as const, key: "unknown", error })
);

// IO操作：ローカルストレージから削除
const removeFromLocalStorage = fromThrowable(
  (key: string): void => {
    localStorage.removeItem(key);
  },
  (error: unknown) => ({ type: "removeError" as const, key: "unknown", error })
);

/**
 * デッキをローカルストレージに保存
 */
export const saveDeckToLocalStorage = (
  deck: readonly DeckCard[]
): Result<void, StorageError> => {
  if (!deck) {
    return err({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "デッキが指定されていません",
    });
  }

  try {
    const serializedDeck = serializeDeckCards(deck);
    const jsonString = JSON.stringify(serializedDeck);

    const saveResult = setToLocalStorage(STORAGE_KEYS.DECK_CARDS, jsonString);
    if (saveResult.isErr()) {
      logger.error("デッキの保存に失敗しました", saveResult.error);
      return err({
        type: "saveError",
        key: STORAGE_KEYS.DECK_CARDS,
        data: deck,
      });
    }

    return ok(undefined);
  } catch (e) {
    logger.error("デッキの保存に失敗しました", e);
    return err({ type: "saveError", key: STORAGE_KEYS.DECK_CARDS, data: deck });
  }
};

/**
 * ローカルストレージからデッキを読み込み
 */
export const loadDeckFromLocalStorage = (
  availableCards: readonly Card[]
): Result<DeckCard[], StorageError> => {
  if (!availableCards) {
    return err({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "利用可能なカードが指定されていません",
    });
  }

  const getResult = getFromLocalStorage(STORAGE_KEYS.DECK_CARDS);
  if (getResult.isErr()) {
    logger.error("保存されたデッキの読み込みに失敗しました", getResult.error);
    return err({ type: "notFound", key: STORAGE_KEYS.DECK_CARDS });
  }

  const savedDeck = getResult.value;
  if (!savedDeck) {
    return ok([]);
  }

  try {
    const parsedDeck: { id: string; count: number }[] = JSON.parse(savedDeck);
    const deckCards = deserializeDeckCards(parsedDeck, availableCards);
    return ok(deckCards);
  } catch (e) {
    logger.error("保存されたデッキの読み込みに失敗しました", e);
    // エラー時はストレージをクリーンアップ
    const cleanupResult = removeDeckCardsFromLocalStorage();
    if (cleanupResult.isErr()) {
      logger.warn(
        "デッキデータのクリーンアップに失敗しました",
        cleanupResult.error
      );
    }
    const nameCleanupResult = removeDeckNameFromLocalStorage();
    if (nameCleanupResult.isErr()) {
      logger.warn(
        "デッキ名のクリーンアップに失敗しました",
        nameCleanupResult.error
      );
    }
    return err({
      type: "parseError",
      key: STORAGE_KEYS.DECK_CARDS,
      data: savedDeck,
    });
  }
};

/**
 * デッキ名をローカルストレージに保存
 */
export const saveDeckName = (name: string): Result<void, StorageError> => {
  if (!name) {
    return err({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_NAME,
      reason: "デッキ名が指定されていません",
    });
  }

  const saveResult = setToLocalStorage(STORAGE_KEYS.DECK_NAME, name);
  if (saveResult.isErr()) {
    logger.error("デッキ名の保存に失敗しました", saveResult.error);
    return err({ type: "saveError", key: STORAGE_KEYS.DECK_NAME, data: name });
  }

  return ok(undefined);
};

/**
 * ローカルストレージからデッキ名を読み込み
 */
export const loadDeckName = (): Result<string, StorageError> => {
  const getResult = getFromLocalStorage(STORAGE_KEYS.DECK_NAME);
  if (getResult.isErr()) {
    logger.error("デッキ名の読み込みに失敗しました", getResult.error);
    return ok("新しいデッキ"); // デフォルト値を返す
  }

  const name = getResult.value;
  return ok(name || "新しいデッキ");
};

/**
 * デッキカードをローカルストレージから削除
 */
export const removeDeckCardsFromLocalStorage = (): Result<
  void,
  StorageError
> => {
  const removeResult = removeFromLocalStorage(STORAGE_KEYS.DECK_CARDS);
  if (removeResult.isErr()) {
    logger.error("デッキカードの削除に失敗しました", removeResult.error);
    return err({ type: "removeError", key: STORAGE_KEYS.DECK_CARDS });
  }

  return ok(undefined);
};

/**
 * デッキ名をローカルストレージから削除
 */
export const removeDeckNameFromLocalStorage = (): Result<
  void,
  StorageError
> => {
  const removeResult = removeFromLocalStorage(STORAGE_KEYS.DECK_NAME);
  if (removeResult.isErr()) {
    logger.error("デッキ名の削除に失敗しました", removeResult.error);
    return err({ type: "removeError", key: STORAGE_KEYS.DECK_NAME });
  }

  return ok(undefined);
};
