/**
 * デッキコードのエンコード・デコード機能を提供するモジュール
 *
 * 対応形式:
 * - スラッシュ区切り形式: カードIDを"/"で連結した形式
 * - KCG形式: "KCG-"で始まる圧縮形式のデッキコード
 */
import type { Card, DeckCard } from "../types";
import { DeckCodeError } from "../types";
import * as v from "valibot";
import { SlashDeckCodeSchema, CardIdSchema } from "../domain";

/**
 * KCGデッキコードで使用する文字マップ（共通）
 * - 行列形式（8x8）と、フラットな連結文字列の両方を提供
 * - デコード側は連結文字列による indexOf を利用
 * - エンコード側は行列の行・列インデックスを利用
 */
const KCG_CHAR_MATRIX = [
  ["A", "I", "Q", "Y", "g", "o", "w", "5"],
  ["B", "J", "R", "Z", "h", "p", "x", "6"],
  ["C", "K", "S", "a", "i", "q", "y", "7"],
  ["D", "L", "T", "b", "j", "r", "z", "8"],
  ["E", "M", "U", "c", "k", "s", "1", "9"],
  ["F", "N", "V", "d", "l", "t", "2", "!"],
  ["G", "O", "W", "e", "m", "u", "3", "?"],
  ["H", "P", "X", "f", "n", "v", "4", "/"],
] as const;

const KCG_CHAR_MAP: string = KCG_CHAR_MATRIX.map((row) => row.join("")).join(
  "",
);

const MAP1_EXPANSION = "eABCDEFGHI";
const MAP2_EXPANSION = "pJKLMNOPQR";

// 逆引きインデックスと存在判定用Set（および重複検出）
const KCG_CHAR_INDEX = new Map<string, number>(
  Array.from(KCG_CHAR_MAP).map((ch, idx) => [ch, idx]),
);
const KCG_CHAR_SET = new Set(KCG_CHAR_INDEX.keys());
if (KCG_CHAR_INDEX.size !== 64) {
  // マップの改変・編集ミスを即時検知
  throw new Error("KCG_CHAR_MAP must contain 64 unique characters.");
}

/**
 * デッキコードをデコード
 */
export const decodeDeckCode = (
  code: string,
  availableCards: readonly Card[],
): { deckCards: DeckCard[]; missingCardIds: string[] } => {
  const parsed = v.safeParse(SlashDeckCodeSchema, code);
  if (!parsed.success) {
    throw new DeckCodeError({
      type: "validation",
      message: parsed.issues[0]?.message ?? "無効なデッキコードです",
      originalError: parsed.issues,
    });
  }

  const cardIds = parsed.output.split("/").filter((id) => id.trim() !== "");

  // availableCardsをMapに変換して高速ルックアップを可能にする
  const availableCardsMap = new Map<string, Card>(
    availableCards.map((c) => [c.id, c] as const),
  );

  const cardCounts = new Map<string, number>();

  for (const id of cardIds) {
    const vId = v.safeParse(CardIdSchema, id);
    if (!vId.success) continue;
    const normalized = vId.output;
    cardCounts.set(normalized, (cardCounts.get(normalized) || 0) + 1);
  }

  const deckCards: DeckCard[] = [];
  const missingCardIds: string[] = [];

  for (const [id, count] of cardCounts) {
    const card = availableCardsMap.get(id); // Mapから直接取得
    if (card) {
      deckCards.push({ card, count });
    } else {
      missingCardIds.push(id);
    }
  }

  return { deckCards, missingCardIds };
};

/**
 * KCG形式のデッキコードをデコード
 * @param deckCode KCG-から始まるデッキコード文字列
 * @returns デコードされたカードIDの配列
 * @note 無効なカードデータ（範囲外のインデックスや値）は警告なくスキップされます
 */
export const decodeKcgDeckCode = (deckCode: string): string[] => {
  try {
    // --- 1. 入力チェックと初期処理 ---
    if (!deckCode || !deckCode.startsWith("KCG-")) {
      throw new DeckCodeError({
        type: "validation",
        message: "デッキコードは'KCG-'で始まる必要があります",
      });
    }

    const rawPayloadWithVersion = deckCode.substring(4);
    if (rawPayloadWithVersion.length === 0) {
      throw new DeckCodeError({
        type: "validation",
        message: "デッキコードのペイロードが空です",
      });
    }

    for (const char of rawPayloadWithVersion) {
      if (!KCG_CHAR_SET.has(char)) {
        throw new DeckCodeError({
          type: "validation",
          message: `デッキコードに無効な文字が含まれています: ${char}`,
        });
      }
    }

    // --- 2. パディングビット数の計算 ---
    // 先頭文字のインデックスから削除するビット数を決定
    const headChar = rawPayloadWithVersion.charAt(0);
    const headIndex1Based = (KCG_CHAR_INDEX.get(headChar) ?? -1) + 1;

    let deckCodeFifthCharQuotient = Math.floor(headIndex1Based / 8);
    const remainderFifthChar = headIndex1Based % 8;

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
      const char = payload.charAt(i);
      const charIndex = KCG_CHAR_INDEX.get(char)!;
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
      throw new DeckCodeError({
        type: "validation",
        message: "最終的な数値文字列の長さが5の倍数ではありません",
      });
    }

    for (let i = 0; i < finalNumericString.length; i += 5) {
      const fiveDigitChunk = finalNumericString.substring(i, i + 5);

      const c1 = parseInt(fiveDigitChunk.charAt(0), 10);
      const c2 = parseInt(fiveDigitChunk.charAt(1), 10);
      const c3 = parseInt(fiveDigitChunk.charAt(2), 10);
      const c4 = parseInt(fiveDigitChunk.charAt(3), 10);
      const c5 = parseInt(fiveDigitChunk.charAt(4), 10);

      let expansionMap: string;
      if (c5 >= 1 && c5 <= 4) {
        expansionMap = MAP1_EXPANSION;
      } else if (c5 >= 6 && c5 <= 9) {
        expansionMap = MAP2_EXPANSION;
      } else {
        continue;
      }

      if (c1 >= expansionMap.length) {
        continue;
      }
      const selectedCharFromMap = expansionMap.charAt(c1);

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
          continue;
      }

      const numberPartInt = c3 * 10 + c4;
      if (numberPartInt < 1 || numberPartInt > 50) {
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

    return deckListOutput;
  } catch (error) {
    if (error instanceof DeckCodeError) throw error;
    throw new DeckCodeError({
      type: "decode",
      message: "デッキコードのデコード中に予期しないエラーが発生しました",
      originalError: error,
    });
  }
};

/**
 * KCG形式のデッキコードをエンコード
 * @param cardIds カードIDの配列
 * @returns エンコードされたKCGデッキコード文字列
 */
export const encodeKcgDeckCode = (cardIds: readonly string[]): string => {
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
      const splitIdx = id.indexOf("-");
      if (splitIdx === -1) {
        throw new DeckCodeError({
          type: "generation",
          message: `不正なカードID形式です: ${id}`,
          invalidId: id,
        });
      }
      const prefix = id.substring(0, splitIdx);
      const numberPart = id.substring(splitIdx + 1);
      const expansion = prefix.slice(0, -1);
      const type = prefix.slice(-1);

      let c1 = "";
      let isExpansionOver9 = false;
      const oVal = O[expansion];
      if (oVal !== undefined) {
        const parsedVal = parseInt(oVal, 10);
        if (parsedVal >= 10) {
          isExpansionOver9 = true;
          c1 = (parsedVal - 10).toString();
        } else {
          c1 = oVal;
        }
      } else {
        throw new DeckCodeError({
          type: "generation",
          message: `未知のエキスパンションです: ${expansion}`,
          invalidId: id,
        });
      }

      const c2 = D[type];
      if (!c2) {
        throw new DeckCodeError({
          type: "generation",
          message: `未知のタイプです: ${type}`,
          invalidId: id,
        });
      }
      const c3c4 = F[numberPart] || numberPart;
      if (count < 1 || count > 4) {
        throw new DeckCodeError({
          type: "generation",
          message: `枚数が範囲外です (1..4): ${count} (${id})`,
          invalidId: id,
        });
      }
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
      throw new DeckCodeError({
        type: "generation",
        message: "バイナリ文字列の分割に失敗しました",
      });
    }
    const i = o.map((e) => parseInt(e, 2));

    let u = "";

    for (let d = 0; d + 1 < i.length; d += 2) {
      const row = i[d] ?? -1;
      const col = i[d + 1] ?? -1;
      if (row >= 0 && row < KCG_CHAR_MATRIX.length) {
        const rowArr = KCG_CHAR_MATRIX[row];
        if (rowArr && col >= 0 && col < rowArr.length) {
          u += rowArr[col];
        }
      }
    }

    const s = 7 - paddingZeros;
    const c = 7 - (o.filter((e) => e === "000").length % 8);

    if (s < 0 || s >= KCG_CHAR_MATRIX.length) {
      throw new DeckCodeError({ type: "generation", message: "不正なs値です" });
    }
    const rowArr = KCG_CHAR_MATRIX[s];
    if (!rowArr) {
      throw new DeckCodeError({
        type: "generation",
        message: "不正な行参照です",
      });
    }
    if (c < 0 || c >= rowArr.length) {
      throw new DeckCodeError({ type: "generation", message: "不正なc値です" });
    }
    const head = rowArr[c]!;
    return `KCG-${head}${u}`;
  } catch (error) {
    if (error instanceof DeckCodeError) throw error;
    throw new DeckCodeError({
      type: "generation",
      message: "デッキコードのエンコード中に予期しないエラーが発生しました",
      originalError: error,
    });
  }
};

/**
 * カードID配列を DeckCard 配列へ集計して変換
 * - 不正なIDは CardIdSchema で除外
 * - 利用可能カードに存在しないIDは missingCardIds に集約
 */
export const toDeckCardsFromCardIds = (
  cardIds: readonly string[],
  availableCards: readonly Card[],
): { deckCards: DeckCard[]; missingCardIds: string[] } => {
  const availableCardsMap = new Map<string, Card>();
  for (const card of availableCards) {
    availableCardsMap.set(card.id, card);
  }

  const counts = new Map<string, number>();
  for (const rawId of cardIds) {
    const trimmed = (rawId ?? "").trim();
    if (!trimmed) continue;
    const parsed = v.safeParse(CardIdSchema, trimmed);
    if (!parsed.success) continue;
    const id = parsed.output;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const deckCards: DeckCard[] = [];
  const missingCardIds: string[] = [];
  for (const [id, count] of counts) {
    const card = availableCardsMap.get(id);
    if (card) {
      deckCards.push({ card, count });
    } else {
      missingCardIds.push(id);
    }
  }

  return { deckCards, missingCardIds };
};
