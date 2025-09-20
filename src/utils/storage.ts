/**
 * @file ストレージユーティリティ
 * - 目的: デッキ名/デッキカードの保存・読込・リセット
 */
import type { Card, DeckCard } from "../types";
import { GAME_CONSTANTS } from "../constants";
import { useLocalStorage } from "@vueuse/core";
import * as v from "valibot";
import { CardIdSchema } from "../domain";

export const DEFAULT_DECK_NAME = "新しいデッキ" as const;

const STORAGE_KEYS = {
  DECK_CARDS: "deckCards_k",
  DECK_NAME: "deckName_k",
};

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
    if (params.data !== undefined) {
      this.data = params.data;
    }
    if (params.reason !== undefined) {
      this.reason = params.reason;
    }
    if (params.originalError !== undefined) {
      this.originalError = params.originalError;
      // Error.cause はオプショナルのため、undefined は代入しない
      (this as any).cause = params.originalError;
    }
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
const DeckItemSchema = v.object({
  id: CardIdSchema,
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
const DeckArraySchema = v.array(DeckItemSchema);
const deckCardsStorage = useLocalStorage<
  readonly { id: string; count: number }[]
>(STORAGE_KEYS.DECK_CARDS, [] as readonly { id: string; count: number }[], {
  serializer: {
    read: (raw: string): readonly { id: string; count: number }[] => {
      try {
        const data = JSON.parse(raw) as unknown;
        const result = v.safeParse(DeckArraySchema, data);
        if (result.success) return result.output;
      } catch (err) {
        console.error(
          "ローカルストレージのデッキカードの JSON 解析に失敗しました",
          err,
        );
      }
      return [] as readonly { id: string; count: number }[];
    },
    write: (value: readonly { id: string; count: number }[]) =>
      JSON.stringify(value),
  },
  writeDefaults: true,
});

// useLocalStorage を使用してデッキ名を管理
const deckNameStorage = useLocalStorage<string | undefined>(
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
    try {
      resetDeckCardsInLocalStorage(); // エラー発生時にリセット
    } catch (resetError) {
      console.error("デッキカードのリセットも失敗しました", resetError);
    }
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
  const NameSchema = v.pipe(v.string(), v.trim(), v.nonEmpty());
  const parsed = v.safeParse(NameSchema, name);
  if (!parsed.success) {
    throw new StorageError({
      type: "invalidData",
      key: STORAGE_KEYS.DECK_NAME,
      reason: parsed.issues[0]?.message ?? "デッキ名が不正です",
      originalError: parsed.issues,
    });
  }

  try {
    deckNameStorage.value = parsed.output;
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
    return deckNameStorage.value ?? DEFAULT_DECK_NAME;
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
