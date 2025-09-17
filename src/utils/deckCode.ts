/**
 * デッキコードのエンコード・デコード機能を提供するモジュール
 *
 * 対応形式:
 * - スラッシュ区切り形式: カードIDを"/"で連結した形式
 * - KCG形式: "KCG-"で始まる圧縮形式のデッキコード
 *
 * エラーハンドリング:
 * - Effectの型を使用してエラーを表現
 * - 例外をスローせず、エラーの詳細を型安全に返却
 */
import type { Card, DeckCard } from "../types";
import { logger } from "./logger";
import { Effect } from "effect";
import { DeckCodeError } from "../types";

// --- KCGデッキコード用定数 ---
const CHAR_MAP =
  "AIQYgow5BJRZhpx6CKSaiqy7DLTbjrz8EMUcks19FNVdlt2!GOWemu3?HPXfnv4/";
const MAP1_EXPANSION = "eABCDEFGHI";
const MAP2_EXPANSION = "pJKLMNOPQR";

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
): Effect.Effect<
  { deckCards: DeckCard[]; missingCardIds: string[] },
  DeckCodeError
> => {
  // 空文字列の場合は早期リターン
  if (!code || code.trim() === "") {
    logger.debug("デッキコードが空です");
    return Effect.fail(
      new DeckCodeError({
        type: "validation",
        message: "デッキコードが空です",
      }),
    );
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

  const deckCards: DeckCard[] = [];
  const missingCardIds: string[] = [];
  let foundCount = 0;

  for (const [id, count] of cardCounts) {
    const card = availableCardsMap.get(id); // Mapから直接取得
    if (card) {
      deckCards.push({ card, count });
      foundCount++;
    } else {
      missingCardIds.push(id);
    }
  }

  logger.debug(`見つかったカード: ${foundCount}/${cardCounts.size}`);
  if (missingCardIds.length > 0) {
    logger.warn("見つからなかったカードID:", missingCardIds);
  }

  return Effect.succeed({ deckCards, missingCardIds });
};

/**
 * KCG形式のデッキコードをデコード
 * @param deckCode KCG-から始まるデッキコード文字列
 * @returns デコードされたカードIDの配列
 * @note 無効なカードデータ（範囲外のインデックスや値）は警告なくスキップされます
 */
export const decodeKcgDeckCode = (
  deckCode: string,
): Effect.Effect<string[], DeckCodeError> => {
  try {
    // --- 1. 入力チェックと初期処理 ---
    if (!deckCode || !deckCode.startsWith("KCG-")) {
      logger.error("Invalid deck code format: Must start with 'KCG-'.");
      return Effect.fail(
        new DeckCodeError({
          type: "validation",
          message: "デッキコードは'KCG-'で始まる必要があります",
        }),
      );
    }

    const rawPayloadWithVersion = deckCode.substring(4);
    if (rawPayloadWithVersion.length === 0) {
      logger.error("Invalid deck code: Payload is empty.");
      return Effect.fail(
        new DeckCodeError({
          type: "validation",
          message: "デッキコードのペイロードが空です",
        }),
      );
    }

    for (const char of rawPayloadWithVersion) {
      if (CHAR_MAP.indexOf(char) === -1) {
        logger.error(`Invalid character in deck code: ${char}`);
        return Effect.fail(
          new DeckCodeError({
            type: "validation",
            message: `デッキコードに無効な文字が含まれています: ${char}`,
          }),
        );
      }
    }

    // --- 2. パディングビット数の計算 ---
    // 先頭文字のインデックスから削除するビット数を決定
    const fifthCharOriginal = rawPayloadWithVersion[0];
    const indexFifthChar = CHAR_MAP.indexOf(fifthCharOriginal) + 1;

    let deckCodeFifthCharQuotient = Math.floor(indexFifthChar / 8);
    const remainderFifthChar = indexFifthChar % 8;

    /*
     * パディングビット数の計算ロジック:
     * - 6ビット文字を8ビット境界に合わせるためのパディングを計算
     * - remainderFifthChar が 0 の場合: パディングは不要
     * - remainderFifthChar が 0 以外の場合:
     *   1. quotientを1増加させる（次の8ビット境界に進む）
     *   2. 削除するビット数 = 8 - quotient
     *      これは8ビット境界から実際のデータビット数を引いた余分なパディングビット数
     */
    let charsToRemoveFromPayloadEnd: number;
    if (remainderFifthChar === 0) {
      charsToRemoveFromPayloadEnd = 0;
    } else {
      deckCodeFifthCharQuotient++;
      // 8ビット境界に合わせるために追加されたパディングビットを削除
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
      return Effect.fail(
        new DeckCodeError({
          type: "validation",
          message: "最終的な数値文字列の長さが5の倍数ではありません",
        }),
      );
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
        // 無効なC5値の場合はスキップ
        continue;
      }

      if (c1 >= expansionMap.length) {
        // 無効なC1インデックスの場合はスキップ
        continue;
      }
      const selectedCharFromMap = expansionMap[c1];

      let expansion: string;
      if (selectedCharFromMap === "e") {
        expansion = "ex";
      } else if (selectedCharFromMap === "p") {
        expansion = "prm";
      } else {
        expansion = selectedCharFromMap;
      }

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
          // 無効なC2値の場合はスキップ
          continue;
      }

      const numberPartInt = c3 * 10 + c4;
      if (numberPartInt < 1 || numberPartInt > 50) {
        // 無効な番号の場合はスキップ
        continue;
      }

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
    return Effect.succeed(deckListOutput);
  } catch (error) {
    logger.error("KCGデッキコードのデコード中にエラーが発生:", error);
    return Effect.fail(
      new DeckCodeError({
        type: "decode",
        message: "デッキコードのデコード中に予期しないエラーが発生しました",
        originalError: error,
      }),
    );
  }
};

/**
 * KCG形式のデッキコードをエンコード
 * @param cardIds カードIDの配列
 * @returns エンコードされたKCGデッキコード文字列
 */
export const encodeKcgDeckCode = (
  cardIds: string[],
): Effect.Effect<string, DeckCodeError> => {
  try {
    const cardCounts: { [key: string]: number } = {};
    cardIds.forEach((id) => {
      cardCounts[id] = (cardCounts[id] || 0) + 1;
    });

    let numericString = "";
    const O: { [key: string]: string } = {
      ex: "0",
      A: "1",
      B: "2",
      C: "3",
      D: "4",
      E: "5",
      F: "6",
      G: "7",
      H: "8",
      I: "9",
      prm: "10",
      J: "11",
      K: "12",
      L: "13",
      M: "14",
      N: "15",
      O: "16",
      P: "17",
      Q: "18",
      R: "19",
    };
    const D: { [key: string]: string } = { A: "1", S: "2", M: "3", D: "4" };
    const F: { [key: string]: string } = {};
    for (let r = 1; r <= 9; r++) F[r.toString()] = "0" + r;

    for (const [id, count] of Object.entries(cardCounts)) {
      const [prefix, numberPart] = id.split("-");
      const expansion = prefix.slice(0, -1);
      const type = prefix.slice(-1);

      let c1 = "";
      let isExpansionOver9 = false;
      if (O[expansion]) {
        if (parseInt(O[expansion]) >= 10) {
          isExpansionOver9 = true;
          c1 = (parseInt(O[expansion]) - 10).toString();
        } else {
          c1 = O[expansion];
        }
      }

      const c2 = D[type];
      const c3c4 = F[numberPart] || numberPart;
      const c5 = isExpansionOver9 ? count + 5 : count;

      numericString += `${c1}${c2}${c3c4}${c5}`;
    }

    let r: number[] = [];
    for (let d = 0; d < numericString.length; d += 3) {
      r.push(parseInt(numericString.substring(d, d + 3)));
    }
    r = r.map((e) => 500 - e);

    let binaryString = r
      .map((e) => (e < 0 ? 1024 + e : e).toString(2).padStart(10, "0"))
      .join("");

    let paddingZeros = 0;
    while (binaryString.length % 6 !== 0) {
      binaryString += "0";
      paddingZeros++;
    }

    const o = binaryString.match(/.{1,3}/g);
    if (!o) {
      return Effect.fail(
        new DeckCodeError({
          type: "generation",
          message: "バイナリ文字列の分割に失敗しました",
        }),
      );
    }
    const i = o.map((e) => parseInt(e, 2));

    let u = "";
    const U = [
      ["A", "I", "Q", "Y", "g", "o", "w", "5"],
      ["B", "J", "R", "Z", "h", "p", "x", "6"],
      ["C", "K", "S", "a", "i", "q", "y", "7"],
      ["D", "L", "T", "b", "j", "r", "z", "8"],
      ["E", "M", "U", "c", "k", "s", "1", "9"],
      ["F", "N", "V", "d", "l", "t", "2", "!"],
      ["G", "O", "W", "e", "m", "u", "3", "?"],
      ["H", "P", "X", "f", "n", "v", "4", "/"],
    ];

    for (let d = 0; d < i.length; d += 2) {
      u += U[i[d]][i[d + 1]];
    }

    const s = 7 - paddingZeros;
    const c = 7 - (o.filter((e) => e === "000").length % 8);

    return Effect.succeed(`KCG-${U[s][c]}${u}`);
  } catch (error) {
    logger.error("KCGデッキコードのエンコード中にエラーが発生:", error);
    return Effect.fail(
      new DeckCodeError({
        type: "generation",
        message: "デッキコードのエンコード中に予期しないエラーが発生しました",
        originalError: error,
      }),
    );
  }
};
