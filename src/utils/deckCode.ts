import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { logger } from "./logger"; // loggerをインポート
import { ok, err, type Result } from "neverthrow"; // Result をインポート

// デッキコードデコードエラー型
export type DeckCodeDecodeError =
  | { readonly type: "emptyCode"; readonly message: string }
  | {
      readonly type: "invalidCardId";
      readonly message: string;
      readonly invalidId: string;
    }
  | {
      readonly type: "cardNotFound";
      readonly message: string;
      readonly notFoundIds: readonly string[];
    }
  | {
      readonly type: "unknown";
      readonly message: string;
      readonly originalError: unknown;
    };

/**
 * デッキコードをエンコード
 */
export const encodeDeckCode = (deck: readonly DeckCard[]): string => {
  const cardIds = deck.flatMap((item: DeckCard) =>
    Array(item.count).fill(item.card.id),
  );
  return cardIds.join("/");
};

/**
 * デッキコードをデコード
 */
export const decodeDeckCode = (
  code: string,
  availableCards: readonly Card[],
): Result<DeckCard[], DeckCodeDecodeError> => {
  // 空文字列の場合は早期リターン
  if (!code || code.trim() === "") {
    logger.debug("デッキコードが空です");
    return err({ type: "emptyCode", message: "デッキコードが空です" });
  }

  const cardIds = code.split("/").filter((id) => id.trim() !== ""); // 空文字列を除外
  logger.debug("分割されたカードID:", cardIds);

  // availableCardsをMapに変換して高速ルックアップを可能にする
  const availableCardsMap = new Map<string, Card>();
  for (const card of availableCards) {
    availableCardsMap.set(card.id, card);
  }
  logger.debug("利用可能カードマップのサイズ:", availableCardsMap.size);

  const cardCounts = new Map<string, number>();

  for (const id of cardIds) {
    const trimmedId = id.trim();
    if (trimmedId) {
      cardCounts.set(trimmedId, (cardCounts.get(trimmedId) || 0) + 1);
    }
  }

  logger.debug("カードID別枚数:", Object.fromEntries(cardCounts));

  const cards: DeckCard[] = [];
  let foundCount = 0;
  let notFoundIds: string[] = [];

  for (const [id, count] of cardCounts) {
    const card = availableCardsMap.get(id); // Mapから直接取得
    if (card) {
      cards.push({ card, count });
      foundCount++;
    } else {
      notFoundIds.push(id);
    }
  }

  logger.debug(`見つかったカード: ${foundCount}/${cardCounts.size}`);
  if (notFoundIds.length > 0) {
    logger.warn("見つからなかったカードID:", notFoundIds);
    return err({
      type: "cardNotFound",
      message: "一部のカードが見つかりませんでした",
      notFoundIds: notFoundIds,
    });
  }

  return ok(cards);
};
