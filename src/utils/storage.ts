import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { STORAGE_KEYS } from "../constants/storage";
import { logger } from "./logger";
import { useLocalStorage } from "@vueuse/core";

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
  deck: readonly DeckCard[],
): readonly { id: string; count: number }[] => {
  return deck.map((item: DeckCard) => ({
    id: item.card.id,
    count: item.count,
  }));
};

// 純粋関数：シリアライズされたデータをデッキカードに復元
export const deserializeDeckCards = (
  serializedDeck: readonly { id: string; count: number }[],
  availableCards: readonly Card[],
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

// useLocalStorage を使用してデッキカードを管理
const deckCardsStorage = useLocalStorage<readonly { id: string; count: number }[]>(
  STORAGE_KEYS.DECK_CARDS,
  [],
  {
    serializer: {
      read: (raw: string): readonly { id: string; count: number }[] => {
        try {
          return JSON.parse(raw);
        } catch (e) {
          logger.error("Failed to parse deck cards from local storage", e);
          return [];
        }
      },
      write: (value: readonly { id: string; count: number }[]) => JSON.stringify(value),
    },
  },
);

// useLocalStorage を使用してデッキ名を管理
const deckNameStorage = useLocalStorage<string>(STORAGE_KEYS.DECK_NAME, "新しいデッキ");

/**
 * デッキをローカルストレージに保存
 */
export const saveDeckToLocalStorage = (deck: readonly DeckCard[]): Result<void, StorageError> => {
  if (!deck) {
    return err({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "デッキが指定されていません",
    });
  }

  try {
    deckCardsStorage.value = serializeDeckCards(deck);
    return ok(undefined);
  } catch (e) {
    logger.error("デッキの保存に失敗しました", e, deck);
    return err({ type: "saveError", key: STORAGE_KEYS.DECK_CARDS, data: deck });
  }
};

/**
 * ローカルストレージからデッキを読み込み
 */
export const loadDeckFromLocalStorage = (
  availableCards: readonly Card[],
): Result<DeckCard[], StorageError> => {
  if (!availableCards) {
    return err({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "利用可能なカードが指定されていません",
    });
  }

  try {
    const parsedDeck = deckCardsStorage.value;
    const deckCards = deserializeDeckCards(parsedDeck, availableCards);
    return ok(deckCards);
  } catch (e) {
    logger.error(
      "保存されたデッキの読み込みに失敗しました",
      e,
      JSON.stringify(deckCardsStorage.value),
    );
    // エラー時はデッキカードのみクリーンアップ（デッキ名は保持）
    removeDeckCardsFromLocalStorage();
    return err({
      type: "parseError",
      key: STORAGE_KEYS.DECK_CARDS,
      data: JSON.stringify(deckCardsStorage.value),
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

  try {
    deckNameStorage.value = name;
    return ok(undefined);
  } catch (e) {
    logger.error("デッキ名の保存に失敗しました", e);
    return err({ type: "saveError", key: STORAGE_KEYS.DECK_NAME, data: name });
  }
};

/**
 * ローカルストレージからデッキ名を読み込み
 */
export const loadDeckName = (): Result<string, StorageError> => {
  try {
    const name = deckNameStorage.value;
    return ok(name || "新しいデッキ");
  } catch (e) {
    logger.error("デッキ名の読み込みに失敗しました", e);
    return ok("新しいデッキ");
  }
};

/**
 * デッキカードをローカルストレージから削除
 */
export const removeDeckCardsFromLocalStorage = (): Result<void, StorageError> => {
  try {
    deckCardsStorage.value = [];
    return ok(undefined);
  } catch (e) {
    logger.error("デッキカードの削除に失敗しました", e, []);
    return err({ type: "removeError", key: STORAGE_KEYS.DECK_CARDS });
  }
};

/**
 * デッキ名をローカルストレージから削除
 */
export const removeDeckNameFromLocalStorage = (): Result<void, StorageError> => {
  try {
    deckNameStorage.value = "新しいデッキ";
    return ok(undefined);
  } catch (e) {
    logger.error("デッキ名の削除に失敗しました", e, "新しいデッキ");
    return err({ type: "removeError", key: STORAGE_KEYS.DECK_NAME });
  }
};
