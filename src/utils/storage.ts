/**
 * @file ストレージユーティリティ
 * - 目的: デッキ名/デッキカードの保存・読込・リセット
 * - 方針: 例外は投げず Effect の Effect を返す。純粋関数と副作用関数を分離。
 */
import { Effect, Data } from "effect";
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS, STORAGE_KEYS } from "../constants";
import { logger } from "./logger";
import { useLocalStorage } from "@vueuse/core";

export const DEFAULT_DECK_NAME = "新しいデッキ" as const;

// ストレージ操作エラー型
export class StorageError extends Data.TaggedError("StorageError")<{
  readonly type: "notFound" | "saveError" | "resetError" | "readError" | "invalidData";
  readonly key: string;
  readonly data?: unknown;
  readonly reason?: string;
  readonly originalError?: unknown;
}> {}

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
  const availableCardsMap = new Map(
    availableCards.map((c) => [c.id, c] as const),
  );

  // 1) 同一IDを合算（不正値は0として除外）し、都度クランプ
  const aggregated = new Map<string, number>();
  for (const item of serializedDeck) {
    const n = Number.isInteger(item.count) && item.count > 0 ? item.count : 0;
    if (n === 0) continue;
    const next = Math.min(
      (aggregated.get(item.id) ?? 0) + n,
      GAME_CONSTANTS.MAX_CARD_COPIES,
    );
    aggregated.set(item.id, next);
  }
  // 2) 実在カードのみDeckCardへ復元
  const out: DeckCard[] = [];
  let remaining = GAME_CONSTANTS.MAX_DECK_SIZE;
  for (const [id, count] of aggregated) {
    if (remaining <= 0) break;
    const card = availableCardsMap.get(id);
    const use = Math.min(count, remaining);
    if (card && use > 0) {
      out.push({ card, count: use });
      remaining -= use;
    }
  }
  return out;
};

// useLocalStorage を使用してデッキカードを管理
const deckCardsStorage = useLocalStorage<
  readonly { id: string; count: number }[]
>(STORAGE_KEYS.DECK_CARDS, [] as readonly { id: string; count: number }[], {
  serializer: {
    read: (raw: string): readonly { id: string; count: number }[] => {
      const parsedEffect = Effect.try({ try: () => JSON.parse(raw) as unknown, catch: (e) => e });
      const parsedResult = Effect.runSync(Effect.either(parsedEffect));

      if (parsedResult._tag === "Right") {
        const data = parsedResult.right;
        const isValidArray =
          Array.isArray(data) &&
          data.every(
            (x) =>
              x &&
              typeof x === "object" &&
              typeof (x as any).id === "string" &&
              Number.isInteger((x as any).count) &&
              (x as any).count >= 0,
          );
        if (isValidArray) {
          return data as { id: string; count: number }[];
        }
        logger.warn(
          "ローカルストレージのデッキカードが想定スキーマではありません。初期化します。",
          data,
        );
      } else {
        logger.error(
          "ローカルストレージのデッキカードの JSON 解析に失敗しました",
          parsedResult.left,
        );
      }
      // 解析/検証失敗時は破損データが残らないよう既定値で上書きする
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            STORAGE_KEYS.DECK_CARDS,
            JSON.stringify([]),
          );
        }
      } catch {
        // noop: リセットに失敗しても空配列で返す
      }
      return [] as { id: string; count: number }[];
    },
    write: (value: readonly { id: string; count: number }[]) =>
      JSON.stringify(value),
  },
  writeDefaults: true,
});

// useLocalStorage を使用してデッキ名を管理
const deckNameStorage = useLocalStorage<string>(
  STORAGE_KEYS.DECK_NAME,
  DEFAULT_DECK_NAME,
);

/**
 * デッキをローカルストレージに保存
 */
export const saveDeckToLocalStorage = (
  deck: readonly DeckCard[],
): Effect.Effect<void, StorageError> => {
  if (!deck) {
    return Effect.fail(new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "デッキが指定されていません",
    }));
  }

  try {
    deckCardsStorage.value = serializeDeckCards(deck);
    return Effect.succeed(undefined);
  } catch (e) {
    logger.error("デッキの保存に失敗しました", e, deck);
    return Effect.fail(new StorageError({ type: "saveError", key: STORAGE_KEYS.DECK_CARDS, data: deck, originalError: e }));
  }
};

/**
 * ローカルストレージからデッキを読み込み
 */
export const loadDeckFromLocalStorage = (
  availableCards: readonly Card[],
): Effect.Effect<DeckCard[], StorageError> => {
  if (!availableCards) {
    return Effect.fail(new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "利用可能なカードが指定されていません",
    }));
  }

  try {
    const parsedDeck = deckCardsStorage.value;
    const deckCards = deserializeDeckCards(parsedDeck, availableCards);
    return Effect.succeed(deckCards);
  } catch (e) {
    const snapshot = (() => {
      try {
        return JSON.stringify(deckCardsStorage.value);
      } catch {
        return "[unserializable]";
      }
    })();
    logger.error("保存されたデッキの読み込みに失敗しました", e, snapshot);
    // エラー時はデッキカードのみクリーンアップ（デッキ名は保持）
    const r = Effect.runSync(Effect.either(resetDeckCardsInLocalStorage()));
    if (r._tag === "Left") {
      logger.error("デッキカードのリセットに失敗しました", r.left);
    }
    return Effect.fail(new StorageError({
      type: "readError",
      key: STORAGE_KEYS.DECK_CARDS,
      data: snapshot,
      originalError: e,
    }));
  }
};

/**
 * デッキ名をローカルストレージに保存
 */
export const saveDeckName = (name: string): Effect.Effect<void, StorageError> => {
  const n = name?.trim();
  if (!n) {
    return Effect.fail(new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_NAME,
      reason: "デッキ名が指定されていません",
    }));
  }

  try {
    deckNameStorage.value = n;
    return Effect.succeed(undefined);
  } catch (e) {
    logger.error("デッキ名の保存に失敗しました", e);
    return Effect.fail(new StorageError({ type: "saveError", key: STORAGE_KEYS.DECK_NAME, data: name, originalError: e }));
  }
};

/**
 * ローカルストレージからデッキ名を読み込み
 */
export const loadDeckName = (): Effect.Effect<string, StorageError> => {
  try {
    const name = deckNameStorage.value;
    return Effect.succeed(name || DEFAULT_DECK_NAME);
  } catch (e) {
    logger.error("デッキ名の読み込みに失敗しました", e);
    return Effect.fail(new StorageError({
      type: "readError",
      key: STORAGE_KEYS.DECK_NAME,
      data: String(e),
      originalError: e,
    }));
  }
};

/**
 * デッキカードをローカルストレージで既定値（空配列）にリセット
 */
export const resetDeckCardsInLocalStorage = (): Effect.Effect<void, StorageError> => {
  try {
    deckCardsStorage.value = [] as readonly { id: string; count: number }[];
    return Effect.succeed(undefined);
  } catch (e) {
    logger.error("デッキカードのリセットに失敗しました", e, []);
    return Effect.fail(new StorageError({ type: "resetError", key: STORAGE_KEYS.DECK_CARDS, originalError: e }));
  }
};

/**
 * デッキ名をローカルストレージの既定値にリセット
 */
export const resetDeckNameInLocalStorage = (): Effect.Effect<void, StorageError> => {
  try {
    deckNameStorage.value = DEFAULT_DECK_NAME;
    return Effect.succeed(undefined);
  } catch (e) {
    logger.error("デッキ名のリセットに失敗しました", e, DEFAULT_DECK_NAME);
    return Effect.fail(new StorageError({ type: "resetError", key: STORAGE_KEYS.DECK_NAME, originalError: e }));
  }
};
