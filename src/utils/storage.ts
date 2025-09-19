/**
 * @file ストレージユーティリティ
 * - 目的: デッキ名/デッキカードの保存・読込・リセット
 */
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS, STORAGE_KEYS } from "../constants";
import { useLocalStorage } from "@vueuse/core";

export const DEFAULT_DECK_NAME = "新しいデッキ" as const;

// ストレージ操作エラー型
export class StorageError extends Error {
  readonly type:
    | "notFound"
    | "saveError"
    | "resetError"
    | "readError"
    | "invalidData";
  readonly key: string;
  readonly data?: unknown;
  readonly reason?: string;
  readonly originalError?: unknown;

  constructor(params: {
    type: "notFound" | "saveError" | "resetError" | "readError" | "invalidData";
    key: string;
    data?: unknown;
    reason?: string;
    originalError?: unknown;
  }) {
    super(
      params.reason || `StorageError: ${params.type} for key ${params.key}`,
    );
    this.name = "StorageError";
    this.type = params.type;
    this.key = params.key;
    this.data = params.data;
    this.reason = params.reason;
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

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
): readonly DeckCard[] => {
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
      try {
        const data = JSON.parse(raw) as unknown;
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
        console.warn(
          "ローカルストレージのデッキカードが想定スキーマではありません。初期化します。",
          data,
        );
      } catch (parsedResult) {
        console.error(
          "ローカルストレージのデッキカードの JSON 解析に失敗しました",
          parsedResult,
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
      return [] as readonly { id: string; count: number }[];
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
export const saveDeckToLocalStorage = (deck: readonly DeckCard[]): void => {
  if (!deck) {
    throw new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "デッキが指定されていません",
    });
  }

  try {
    deckCardsStorage.value = serializeDeckCards(deck);
  } catch (e) {
    console.error("デッキの保存に失敗しました", e, deck);
    throw new StorageError({
      type: "saveError",
      key: STORAGE_KEYS.DECK_CARDS,
      data: deck,
      originalError: e,
    });
  }
};

/**
 * ローカルストレージからデッキを読み込み
 */
export const loadDeckFromLocalStorage = (
  availableCards: readonly Card[],
): readonly DeckCard[] => {
  if (!availableCards) {
    throw new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_CARDS,
      reason: "利用可能なカードが指定されていません",
    });
  }

  try {
    const parsedDeck = deckCardsStorage.value;
    return deserializeDeckCards(parsedDeck, availableCards);
  } catch (e) {
    const snapshot = (() => {
      try {
        return JSON.stringify(deckCardsStorage.value);
      } catch {
        return "[unserializable]";
      }
    })();
    console.error("保存されたデッキの読み込みに失敗しました", e, snapshot);
    resetDeckCardsInLocalStorage(); // エラー発生時にリセット
    throw new StorageError({
      type: "readError",
      key: STORAGE_KEYS.DECK_CARDS,
      data: snapshot,
      originalError: e,
    });
  }
};

/**
 * デッキ名をローカルストレージに保存
 */
export const saveDeckName = (name: string): void => {
  const n = name?.trim();
  if (!n) {
    throw new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_NAME,
      reason: "デッキ名が指定されていません",
    });
  }

  try {
    deckNameStorage.value = n;
  } catch (e) {
    console.error("デッキ名の保存に失敗しました", e);
    throw new StorageError({
      type: "saveError",
      key: STORAGE_KEYS.DECK_NAME,
      data: name,
      originalError: e,
    });
  }
};

/**
 * ローカルストレージからデッキ名を読み込み
 */
export const loadDeckName = (): string => {
  try {
    return deckNameStorage.value || DEFAULT_DECK_NAME;
  } catch (e) {
    console.error("デッキ名の読み込みに失敗しました", e);
    throw new StorageError({
      type: "readError",
      key: STORAGE_KEYS.DECK_NAME,
      data: String(e),
      originalError: e,
    });
  }
};

/**
 * デッキカードをローカルストレージで既定値（空配列）にリセット
 */
export const resetDeckCardsInLocalStorage = (): void => {
  try {
    deckCardsStorage.value = [] as readonly { id: string; count: number }[];
  } catch (e) {
    console.error("デッキカードのリセットに失敗しました", e, []);
    throw new StorageError({
      type: "resetError",
      key: STORAGE_KEYS.DECK_CARDS,
      originalError: e,
    });
  }
};

/**
 * デッキ名をローカルストレージの既定値にリセット
 */
export const resetDeckNameInLocalStorage = (): void => {
  try {
    deckNameStorage.value = DEFAULT_DECK_NAME;
  } catch (e) {
    console.error("デッキ名のリセットに失敗しました", e, DEFAULT_DECK_NAME);
    throw new StorageError({
      type: "resetError",
      key: STORAGE_KEYS.DECK_NAME,
      originalError: e,
    });
  }
};
