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
      readonly type: "invalidFormat";
      readonly message: string;
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

/**
 * KCG形式のデッキコードをデコード
 * @param deckCode KCG-から始まるデッキコード文字列
 * @returns デコードされたカードIDの配列
 */
export const decodeKcgDeckCode = (
  deckCode: string,
): Result<string[], DeckCodeDecodeError> => {
  try {
    // --- 定数定義 (IDHolder.csの定数に対応) ---
    const CHAR_MAP =
      "AIQYgow5BJRZhpx6CKSaiqy7DLTbjrz8EMUcks19FNVdlt2!GOWemu3?HPXfnv4/";
    const MAP1_EXPANSION = "eABCDEFGHI";
    const MAP2_EXPANSION = "pJKLMNOPQR";

    // --- 1. 入力チェックと初期処理 ---
    if (!deckCode || !deckCode.startsWith("KCG-")) {
      logger.error("Invalid deck code format: Must start with 'KCG-'.");
      return err({
        type: "invalidFormat",
        message: "デッキコードは'KCG-'で始まる必要があります",
      });
    }

    const rawPayloadWithVersion = deckCode.substring(4);
    if (rawPayloadWithVersion.length === 0) {
      logger.error("Invalid deck code: Payload is empty.");
      return err({
        type: "invalidFormat",
        message: "デッキコードのペイロードが空です",
      });
    }

    for (const char of rawPayloadWithVersion) {
      if (CHAR_MAP.indexOf(char) === -1) {
        logger.error(`Invalid character in deck code: ${char}`);
        return err({
          type: "invalidFormat",
          message: `デッキコードに無効な文字が含まれています: ${char}`,
        });
      }
    }

    // --- 2. キー文字を解析し、削除するビット数を計算 ---
    const fifthCharOriginal = rawPayloadWithVersion[0];
    const indexFifthChar = CHAR_MAP.indexOf(fifthCharOriginal) + 1;

    let deckCodeFifthCharQuotient = Math.floor(indexFifthChar / 8);
    const remainderFifthChar = indexFifthChar % 8;

    let charsToRemoveFromPayloadEnd: number;
    if (remainderFifthChar === 0) {
      charsToRemoveFromPayloadEnd = 0;
    } else {
      deckCodeFifthCharQuotient++;
      charsToRemoveFromPayloadEnd = 8 - deckCodeFifthCharQuotient;
    }

    // --- 3. ペイロードを6ビットのバイナリ文字列に変換 ---
    let initialBinaryPayload = "";
    const payload = rawPayloadWithVersion.substring(1);
    for (let i = 0; i < payload.length; i++) {
      const char = payload[i];
      const charIndex = CHAR_MAP.indexOf(char);
      initialBinaryPayload += charIndex.toString(2).padStart(6, "0");
    }

    // --- 4. パディングを削除 ---
    let processedBinaryPayload = initialBinaryPayload;
    if (
      charsToRemoveFromPayloadEnd > 0 &&
      initialBinaryPayload.length >= charsToRemoveFromPayloadEnd
    ) {
      processedBinaryPayload = initialBinaryPayload.substring(
        0,
        initialBinaryPayload.length - charsToRemoveFromPayloadEnd,
      );
    } else if (charsToRemoveFromPayloadEnd > 0) {
      processedBinaryPayload = "";
    }

    // --- 5. バイナリを数値文字列に変換 ---
    let intermediateString = "";
    for (let i = 0; i + 10 <= processedBinaryPayload.length; i += 10) {
      const tenBitChunk = processedBinaryPayload.substring(i, i + 10);

      // 10ビットの2の補数を10進数に変換
      let signedDecimalVal: number;
      if (tenBitChunk[0] === "1") {
        const unsignedVal = parseInt(tenBitChunk, 2);
        signedDecimalVal = unsignedVal - 1024; // 1024 = 2^10
      } else {
        signedDecimalVal = parseInt(tenBitChunk, 2);
      }

      const nVal = 500 - signedDecimalVal;

      // C#のロジックに基づき'X'でパディング
      let formattedNVal: string;
      if (nVal >= 0 && nVal < 10) {
        formattedNVal = "XX" + nVal.toString();
      } else if (nVal >= 10 && nVal < 100) {
        formattedNVal = "X" + nVal.toString();
      } else {
        formattedNVal = nVal.toString();
      }
      intermediateString += formattedNVal;
    }

    // --- 6. 数値文字列を5の倍数に調整し、'X'を'0'に置換 ---
    const remainderForFive = intermediateString.length % 5;
    let adjustedString = intermediateString;
    if (remainderForFive !== 0) {
      let charsToActuallyRemove = remainderForFive;
      let stringAsArray = intermediateString.split("");
      let removedXCount = 0;

      // まず末尾から優先的に 'X' を削除
      for (
        let i = stringAsArray.length - 1;
        i >= 0 && removedXCount < charsToActuallyRemove;
        i--
      ) {
        if (stringAsArray[i] === "X") {
          stringAsArray.splice(i, 1);
          removedXCount++;
        }
      }

      // それでも足りなければ、残りの文字を末尾から削除
      const remainingCharsToRemove = charsToActuallyRemove - removedXCount;
      if (remainingCharsToRemove > 0) {
        stringAsArray.splice(
          stringAsArray.length - remainingCharsToRemove,
          remainingCharsToRemove,
        );
      }
      adjustedString = stringAsArray.join("");
    }

    const finalNumericString = adjustedString.replace(/X/g, "0");

    // --- 7. 数値文字列をカード情報にデコード ---
    const decodedEntries: { cardIdPart: string; originalC5Value: number }[] =
      [];
    if (finalNumericString.length % 5 !== 0) {
      logger.error("Final numeric string length is not a multiple of 5.");
      return err({
        type: "invalidFormat",
        message: "最終的な数値文字列の長さが5の倍数ではありません",
      });
    }

    for (let i = 0; i < finalNumericString.length; i += 5) {
      const fiveDigitChunk = finalNumericString.substring(i, i + 5);

      const c1 = parseInt(fiveDigitChunk[0], 10);
      const c2 = parseInt(fiveDigitChunk[1], 10);
      const c3 = parseInt(fiveDigitChunk[2], 10);
      const c4 = parseInt(fiveDigitChunk[3], 10);
      const c5 = parseInt(fiveDigitChunk[4], 10);

      let expansionMap: string;
      if (c5 >= 1 && c5 <= 4) {
        expansionMap = MAP1_EXPANSION;
      } else if (c5 >= 6 && c5 <= 9) {
        expansionMap = MAP2_EXPANSION;
      } else {
        continue; // 無効なC5値
      }

      if (c1 >= expansionMap.length) continue; // 無効なC1インデックス
      const selectedCharFromMap = expansionMap[c1];

      let expansion: string;
      if (selectedCharFromMap === "e") expansion = "ex";
      else if (selectedCharFromMap === "p") expansion = "prm";
      else expansion = selectedCharFromMap;

      let type: string;
      switch (c2) {
        case 1:
          type = "A";
          break;
        case 2:
          type = "S";
          break;
        case 3:
          type = "M";
          break;
        case 4:
          type = "D";
          break;
        default:
          continue; // 無効なC2値
      }

      const numberPartInt = c3 * 10 + c4;
      if (numberPartInt < 1 || numberPartInt > 50) continue; // 無効な番号

      const cardIdPart = `${expansion}${type}-${numberPartInt}`;
      decodedEntries.push({ cardIdPart, originalC5Value: c5 });
    }

    // --- 8. 最終的なデッキデータ文字列を生成 ---
    const deckListOutput: string[] = [];
    for (const entry of decodedEntries) {
      const repeatCount = entry.originalC5Value % 5;
      for (let r = 0; r < repeatCount; r++) {
        deckListOutput.push(entry.cardIdPart);
      }
    }

    logger.debug("KCGデッキコードのデコード完了:", deckListOutput);
    return ok(deckListOutput);
  } catch (error) {
    logger.error("KCGデッキコードのデコード中にエラーが発生:", error);
    return err({
      type: "unknown",
      message: "デッキコードのデコード中に予期しないエラーが発生しました",
      originalError: error,
    });
  }
};
