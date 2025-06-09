import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { STORAGE_KEYS } from "../constants/storage";
import { logger } from "./logger"; // loggerをインポート

/**
 * デッキをローカルストレージに保存
 */
export const saveDeckToLocalStorage = (
  deck: readonly DeckCard[]
): Result<void, { message: string; originalError: unknown }> => {
  if (!deck) {
    return err({ message: "デッキが指定されていません", originalError: null });
  }

  try {
    const simpleDeck = deck.map((item: DeckCard) => ({
      id: item.card.id,
      count: item.count,
    }));
    localStorage.setItem(STORAGE_KEYS.DECK_CARDS, JSON.stringify(simpleDeck));
    return ok(undefined);
  } catch (e) {
    logger.error("デッキの保存に失敗しました", e);
    return err({ message: "デッキの保存に失敗しました", originalError: e });
  }
};

/**
 * ローカルストレージからデッキを読み込み
 */
export const loadDeckFromLocalStorage = (
  availableCards: readonly Card[]
): Result<DeckCard[], { message: string; originalError: unknown }> => {
  if (!availableCards) {
    return err({
      message: "利用可能なカードが指定されていません",
      originalError: null,
    });
  }

  try {
    const savedDeck = localStorage.getItem(STORAGE_KEYS.DECK_CARDS);
    if (!savedDeck) {
      return ok([]);
    }

    const simpleDeck: { id: string; count: number }[] = JSON.parse(savedDeck);

    // availableCardsをMapに変換して高速ルックアップを可能にする
    const availableCardsMap = new Map<string, Card>();
    for (const card of availableCards) {
      availableCardsMap.set(card.id, card);
    }

    const deckCards = simpleDeck
      .map((item: { id: string; count: number }) => {
        const card = availableCardsMap.get(item.id);
        return card ? { card: card, count: item.count } : null;
      })
      .filter((item: DeckCard | null): item is DeckCard => item !== null);

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
      message: "保存されたデッキの読み込みに失敗しました",
      originalError: e,
    });
  }
};

/**
 * デッキ名をローカルストレージに保存
 */
export const saveDeckName = (
  name: string
): Result<void, { message: string; originalError: unknown }> => {
  if (!name) {
    return err({
      message: "デッキ名が指定されていません",
      originalError: null,
    });
  }

  try {
    localStorage.setItem(STORAGE_KEYS.DECK_NAME, name);
    return ok(undefined);
  } catch (e) {
    logger.error("デッキ名の保存に失敗しました", e);
    return err({ message: "デッキ名の保存に失敗しました", originalError: e });
  }
};

/**
 * ローカルストレージからデッキ名を読み込み
 */
export const loadDeckName = (): Result<
  string,
  { message: string; originalError: unknown }
> => {
  try {
    const name = localStorage.getItem(STORAGE_KEYS.DECK_NAME);
    return ok(name || "新しいデッキ");
  } catch (e) {
    logger.error("デッキ名の読み込みに失敗しました", e);
    return err({
      message: "デッキ名の読み込みに失敗しました",
      originalError: e,
    });
  }
};

/**
 * デッキカードをローカルストレージから削除
 */
export const removeDeckCardsFromLocalStorage = (): Result<
  void,
  { message: string; originalError: unknown }
> => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DECK_CARDS);
    return ok(undefined);
  } catch (e) {
    logger.error("デッキカードの削除に失敗しました", e);
    return err({
      message: "デッキカードの削除に失敗しました",
      originalError: e,
    });
  }
};

/**
 * デッキ名をローカルストレージから削除
 */
export const removeDeckNameFromLocalStorage = (): Result<
  void,
  { message: string; originalError: unknown }
> => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DECK_NAME);
    return ok(undefined);
  } catch (e) {
    logger.error("デッキ名の削除に失敗しました", e);
    return err({ message: "デッキ名の削除に失敗しました", originalError: e });
  }
};
