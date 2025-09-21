/**
 * @file cardDataConverter.ts
 * @brief CSV形式のカードデータを読み込み、パースしてCardオブジェクトの配列に変換するユーティリティ。
 *        外部のCSVファイルからカードデータを取得し、アプリケーションで利用可能な形式に整形する機能を提供します。
 */

import type { Card, CardType } from "../types";
import { CARD_KINDS, CARD_TYPES } from "../constants";
import { CardIdSchema } from "../domain";
import * as v from "valibot";
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
export class CardDataConverterError extends Error {
  readonly type:
    | "FetchError"
    | "EmptyCsvError"
    | "ParseError"
    | "ValidationError";
  readonly originalError?: unknown;

  constructor(params: {
    type: "FetchError" | "EmptyCsvError" | "ParseError" | "ValidationError";
    message: string;
    originalError?: unknown;
  }) {
    super(params.message, { cause: params.originalError });
    this.name = "CardDataConverterError";
    this.type = params.type;
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, CardDataConverterError.prototype);
  }
}

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
      const char = remaining.charAt(0);
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

// Valibot スキーマ（CSV 行 → 正規化）
const CsvKindSchema = v.picklist(CARD_KINDS);
const CsvTypeTokenSchema = v.picklist(CARD_TYPES);
const CsvIdName = v.pipe(v.string(), v.trim(), v.nonEmpty());
const CsvTypeArray = v.pipe(
  v.array(v.string()),
  v.transform((arr) => arr.filter((x) => x && x.length > 0)),
);
const CsvTagsArray = v.pipe(
  v.array(v.string()),
  v.transform((arr) =>
    Array.from(new Set(arr.filter((x) => x && x.length > 0))),
  ),
);
const CsvRowSchema = v.object({
  id: CsvIdName,
  name: CsvIdName,
  kind: v.pipe(
    v.string(),
    v.trim(),
    v.transform((s) => s as string),
  ),
  type: CsvTypeArray,
  effect: v.optional(
    v.pipe(
      v.string(),
      v.transform((s) => s.trim()),
      v.nonEmpty(),
    ),
    undefined,
  ),
  tags: CsvTagsArray,
});

const toCardTypeArray = (tokens: string[]): CardType[] => {
  const result: CardType[] = [];
  for (const token of tokens) {
    const r = v.safeParse(CsvTypeTokenSchema, token);
    if (!r.success) {
      throw new CardDataConverterError({
        type: "ValidationError",
        message: `不正なCardTypeが見つかりました: ${token}. 有効な値: ${CARD_TYPES.join(", ")}`,
      });
    }
    result.push(r.output);
  }
  // 重複チェック
  if (new Set(result).size !== result.length) {
    throw new CardDataConverterError({
      type: "ValidationError",
      message: `CardTypeが重複しています: ${result.join("/")}`,
    });
  }
  return result;
};

export async function loadCardsFromCsv(csvPath: string): Promise<Card[]> {
  try {
    const response = await fetch(csvPath, {
      method: "GET",
      headers: { Accept: "text/csv,text/plain,*/*" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new CardDataConverterError({
        type: "FetchError",
        message: `HTTP ${response.status} ${response.statusText}`,
        originalError: new Error("bad status"),
      });
    }

    const csvText = await response.text();

    if (!csvText || csvText.trim().length === 0) {
      throw new CardDataConverterError({
        type: "EmptyCsvError",
        message: "CSVデータが空です。",
      });
    }

    return parseCsv(csvText);
  } catch (error) {
    if (error instanceof CardDataConverterError) throw error;
    console.error("loadCardsFromCsv error:", error);
    throw new CardDataConverterError({
      type: "FetchError",
      message: `ネットワークエラー: ${error instanceof Error ? error.message : String(error)}`,
      originalError: error,
    });
  }
}

function parseCsv(csvText: string): Card[] {
  const parseResult = Papa.parse<CsvCardRow>(csvText, {
    header: true, // ヘッダー行をオブジェクトのキーとして使用
    skipEmptyLines: true, // 空行をスキップ
    transform: (value, field) => {
      // 各フィールドの値を変換
      if (field === "id" || field === "name" || field === "kind") {
        return typeof value === "string" ? value.trim() : value;
      }
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
    console.error("PapaParse errors:", parseResult.errors);
    throw new CardDataConverterError({
      type: "ParseError",
      message: `CSVパースエラー: ${parseResult.errors[0]?.message ?? "unknown"}`,
      originalError: parseResult.errors[0] ?? undefined,
    });
  }

  const cards: Card[] = [];
  for (const row of parseResult.data) {
    const parsed = v.safeParse(CsvRowSchema, row);
    if (!parsed.success) {
      const idForMsg = typeof row.id === "string" ? row.id : "N/A";
      throw new CardDataConverterError({
        type: "ValidationError",
        message: `CSV行の検証に失敗しました (ID: ${idForMsg})`,
        originalError: parsed.issues,
      });
    }

    // 追加: CardIdSchema による ID の厳格検証
    const idResult = v.safeParse(CardIdSchema, parsed.output.id);
    if (!idResult.success) {
      continue; // 無効IDの行はスキップ
    }

    // kind の最終検証（ピックリスト化）
    const kindResult = v.safeParse(CsvKindSchema, parsed.output.kind);
    if (!kindResult.success) {
      throw new CardDataConverterError({
        type: "ValidationError",
        message: `不正なCardKindが見つかりました: ${parsed.output.kind} (ID: ${parsed.output.id}). 有効な値: ${CARD_KINDS.join(", ")}`,
      });
    }

    const types = toCardTypeArray(parsed.output.type);
    const base = {
      id: idResult.output,
      name: parsed.output.name,
      kind: kindResult.output,
      type: types,
      tags: parsed.output.tags as readonly string[],
    } satisfies Omit<Card, "effect">;

    const card: Card =
      parsed.output.effect !== undefined && parsed.output.effect !== ""
        ? { ...base, effect: parsed.output.effect }
        : base;

    cards.push(card);
  }

  return cards;
}
