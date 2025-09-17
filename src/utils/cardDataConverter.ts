/**
 * @file cardDataConverter.ts
 * @brief CSV形式のカードデータを読み込み、パースしてCardオブジェクトの配列に変換するユーティリティ。
 *        外部のCSVファイルからカードデータを取得し、アプリケーションで利用可能な形式に整形する機能を提供します。
 *        EffectのEffect型を使用して、成功または失敗の結果を明示的に扱います。
 */

import type { Card, CardKind, CardType } from "../types";
import { CARD_KINDS, CARD_TYPES } from "../constants";
import { Effect, Data } from "effect";
import { logger } from "./logger";
import Papa from "papaparse";

interface CsvCardRow {
  id: string;
  name: string;
  kind: string;
  type: string[];
  effect: string;
  tags: string[];
}

// カードデータ変換エラー型
export class CardDataConverterError extends Data.TaggedError("CardDataConverterError")<{
  readonly type: "FetchError" | "EmptyCsvError" | "ParseError" | "ValidationError";
  readonly message: string;
  readonly originalError?: unknown;
}> {}

// 長いトークンを優先するためにソート
const TYPE_TOKENS = [...CARD_TYPES].sort((a, b) => b.length - a.length);

/**
 * カードタイプ文字列をトークンに分割する
 * @param value 分割する文字列
 * @returns 分割されたCardTypeの配列
 */
function tokenizeCardTypes(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return [];
  }

  // "/" で分割するケースを優先
  if (trimmedValue.includes("/")) {
    return trimmedValue
      .split("/")
      .map((s) => s.trim())
      .filter((s) => s !== "");
  }

  const result: string[] = [];
  let remaining = trimmedValue;

  while (remaining.length > 0) {
    let matched = false;
    for (const token of TYPE_TOKENS) {
      if (remaining.startsWith(token)) {
        result.push(token);
        remaining = remaining.substring(token.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // どのトークンにも一致しない場合は、最初の1文字を消費して続行
      const char = remaining[0];
      result.push(char);
      remaining = remaining.substring(1);
    }
  }
  return result;
}

/**
 * タグ文字列を分割する
 * @param value 分割する文字列
 * @returns 分割されたタグの配列
 */
function splitTags(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(/[/,|、]/) // /,|、のいずれかで分割
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * 指定された値がCardKindのいずれかであるかを判定する型ガード
 * @param value 判定する値
 * @returns CardKindであればtrue、そうでなければfalse
 */
function isCardKind(value: string): value is CardKind {
  return (CARD_KINDS as readonly string[]).includes(value);
}

/**
 * 指定された値がCardTypeのいずれかであるかを判定する型ガード
 * @param value 判定する値
 * @returns CardTypeであればtrue、そうでなければfalse
 */
function isCardType(value: string): value is CardType {
  return (CARD_TYPES as readonly string[]).includes(value);
}

export function loadCardsFromCsv(
  csvPath: string,
): Effect.Effect<Card[], CardDataConverterError> {
  if (import.meta.env?.DEV)
    logger.debug("Attempting to fetch CSV from:", csvPath);

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(csvPath, {
        method: "GET",
        headers: {
          Accept: "text/csv,text/plain,*/*",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} ${response.statusText}`,
        );
      }

      const csvText = await response.text();

      if (!csvText || csvText.trim().length === 0) {
        throw new Error("CSVデータが空です。");
      }

      if (import.meta.env?.DEV)
        logger.debug("CSV data fetched successfully, length:", csvText.length);

      return csvText;
    },
    catch: (error) => {
      logger.error("Fetch error:", error);
      if (error instanceof Error && error.message.startsWith("HTTP error!")) {
        return new CardDataConverterError({
          type: "FetchError",
          message: "カードデータの取得に失敗しました",
          originalError: error,
        });
      }
      if (error instanceof Error && error.message === "CSVデータが空です。") {
        return new CardDataConverterError({
          type: "EmptyCsvError",
          message: "CSVデータが空です。",
          originalError: error,
        });
      }
      return new CardDataConverterError({
        type: "FetchError",
        message: `ネットワークエラー: ${error instanceof Error ? error.message : String(error)}`,
        originalError: error,
      });
    },
  }).pipe(
    Effect.andThen((csvText) => parseCsv(csvText)),
  );
}

function parseCsv(csvText: string): Effect.Effect<Card[], CardDataConverterError> {
  if (import.meta.env?.DEV) logger.debug("Parsing CSV text with PapaParse...");
  const parseResult = Papa.parse<CsvCardRow>(csvText, {
    header: true, // ヘッダー行をオブジェクトのキーとして使用
    skipEmptyLines: true, // 空行をスキップ
    transform: (value, field) => {
      // 各フィールドの値を変換
      if (field === "type") {
        return tokenizeCardTypes(value);
      }
      if (field === "tags") {
        return splitTags(value);
      }
      return value;
    },
  });

  if (parseResult.errors.length > 0) {
    logger.error("PapaParse errors:", parseResult.errors);
    return Effect.fail(
      new CardDataConverterError({
        type: "ParseError",
        message: `CSVパースエラー: ${parseResult.errors[0].message}`,
        originalError: parseResult.errors[0],
      }),
    );
  }

  const cards: Card[] = [];
  for (const row of parseResult.data) {
    // CardKindの検証
    if (!isCardKind(row.kind)) {
      return Effect.fail(
        new CardDataConverterError({
          type: "ValidationError",
          message: `不正なCardKindが見つかりました: ${row.kind} (ID: ${row.id}). 有効な値: ${CARD_KINDS.join(", ")}`,
        }),
      );
    }

    if (!row.id?.trim() || !row.name?.trim()) {
      return Effect.fail(
        new CardDataConverterError({
          type: "ValidationError",
          message: `必須フィールド欠落: id/name が空です (ID: ${row.id ?? "N/A"})`,
        }),
      );
    }

    // CardTypeの検証
    const types: CardType[] = [];
    for (const typeValue of row.type) {
      if (isCardType(typeValue)) {
        types.push(typeValue);
      } else {
        return Effect.fail(
          new CardDataConverterError({
            type: "ValidationError",
            message: `不正なCardTypeが見つかりました: ${typeValue} (ID: ${row.id}). 有効な値: ${CARD_TYPES.join(", ")}`,
          }),
        );
      }
    }

    // transform後は string[] で正規化済み
    const tags: string[] = row.tags;

    cards.push({
      id: row.id.trim(),
      name: row.name.trim(),
      kind: row.kind, // 型ガードによりCardKindとして扱える
      type: types,
      effect: row.effect,
      tags: tags,
    });
  }

  if (import.meta.env?.DEV)
    logger.debug("Successfully parsed cards:", cards.length);
  return Effect.succeed(cards);
}
