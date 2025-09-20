/**
 * @file カードのドメインロジックを定義する。
 *
 * このファイルでは、カードの作成、検索、フィルタリングに関する純粋関数を提供する。
 * - カードのバリデーションと生成
 * - カード名、種別、タイプ、タグによるフィルタリング
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 */
import type { Card, CardKind, CardType } from "../types";
import * as v from "valibot";
import { CardKindSchema, CardTypeSchema } from "./validation";

/**
 * カードの検証中に発生しうるエラーを表す代数的データ型。
 * - `InvalidId`: カードIDが無効。
 * - `InvalidName`: カード名が無効。
 * - `InvalidKind`: カード種別が無効。
 * - `InvalidType`: カードタイプが無効。
 * - `EmptyTypeList`: 空配列
 * - `DuplicateTypes`: 重複
 * - `DuplicateTags`: 重複するタグが存在する。
 */
export class CardValidationError extends Error {
  readonly type:
    | "InvalidId"
    | "InvalidName"
    | "InvalidKind"
    | "InvalidType"
    | "EmptyTypeList"
    | "DuplicateTypes"
    | "DuplicateTags";
  readonly value?: string | readonly string[];

  private static getErrorMessage = (
    type: CardValidationError["type"],
    value?: string | readonly string[],
  ): string => {
    switch (type) {
      case "InvalidId":
        return `無効なカードID: ${value || "空"}`;
      case "InvalidName":
        return `無効なカード名: ${value || "空"}`;
      case "InvalidKind":
        return `無効なカード種別: ${value}`;
      case "InvalidType":
        return `無効なカードタイプ: ${value}`;
      case "EmptyTypeList":
        return "カードタイプリストが空です";
      case "DuplicateTypes":
        return `重複するカードタイプ: ${Array.isArray(value) ? value.join(", ") : value}`;
      case "DuplicateTags":
        return `重複するタグ: ${Array.isArray(value) ? value.join(", ") : value}`;
      default:
        return `CardValidationError: ${type}`;
    }
  };

  constructor(params: {
    type:
      | "InvalidId"
      | "InvalidName"
      | "InvalidKind"
      | "InvalidType"
      | "EmptyTypeList"
      | "DuplicateTypes"
      | "DuplicateTags";
    value?: string | readonly string[];
  }) {
    super(CardValidationError.getErrorMessage(params.type, params.value));
    this.name = "CardValidationError";
    this.type = params.type;
    this.value = params.value;
    Object.setPrototypeOf(this, CardValidationError.prototype);
  }
}

// Valibot スキーマ定義（実行時バリデーション + 正規化）
const NonEmptyTrimmedString = v.pipe(v.string(), v.trim(), v.nonEmpty());
const CardTypeListSchema = v.pipe(
  v.array(CardTypeSchema),
  v.minLength(1, "CardType は1つ以上必要です"),
  v.checkItems(
    (item, index, array) => array.indexOf(item) === index,
    "CardType に重複があります",
  ),
);
const TagsSchema = v.optional(
  v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.transform((s) => s.trim()),
      ),
    ),
    v.transform((tags: string[]) =>
      Array.from(new Set(tags.filter((t: string) => t.length > 0))),
    ),
  ),
);

const CreateCardInputSchema = v.object({
  id: NonEmptyTrimmedString,
  name: NonEmptyTrimmedString,
  kind: CardKindSchema,
  type: CardTypeListSchema,
  tags: TagsSchema,
});

// カード作成関数（valibot による検証）
export const createCard = (
  id: string,
  name: string,
  kind: CardKind,
  type: readonly CardType[],
  tags?: readonly string[],
): Card => {
  const result = v.safeParse(CreateCardInputSchema, {
    id,
    name,
    kind,
    type: [...type],
    tags: tags ? [...tags] : undefined,
  });

  if (!result.success) {
    // 代表的なエラー型にマップして既存のエラー型を維持
    const issues = result.issues;
    const byKey = (k: string) =>
      issues.find((i) => i.path?.some((p) => p.key === k));
    if (byKey("id"))
      throw new CardValidationError({ type: "InvalidId", value: id });
    if (byKey("name"))
      throw new CardValidationError({ type: "InvalidName", value: name });
    if (byKey("kind"))
      throw new CardValidationError({
        type: "InvalidKind",
        value: String(kind),
      });
    if (byKey("type")) {
      const tIssue = byKey("type");
      const msg = tIssue?.message ?? "type invalid";
      if (msg.includes("1つ以上") || msg.toLowerCase().includes("min")) {
        throw new CardValidationError({ type: "EmptyTypeList" });
      }
      if (msg.includes("重複")) {
        throw new CardValidationError({ type: "DuplicateTypes", value: type });
      }
      throw new CardValidationError({
        type: "InvalidType",
        value: type.join(", "),
      });
    }
    // フォールバック
    throw new Error("Invalid card input");
  }

  const normalized = result.output;
  return {
    id: normalized.id,
    name: normalized.name,
    kind: normalized.kind,
    type: normalized.type as readonly CardType[],
    tags: normalized.tags as readonly string[] | undefined,
  };
};

// カードが特定のタグを持つかチェック
export const hasTag = (card: Card, tag: string): boolean => {
  return card.tags?.includes(tag) ?? false;
};

// カード名による検索
export const searchCardsByName = (
  cards: readonly Card[],
  searchText: string,
): readonly Card[] => {
  if (!searchText || searchText.trim().length === 0) {
    return cards;
  }

  const normalizedSearchText = searchText.trim().toLowerCase();
  return cards.filter(
    (card) =>
      card.name.toLowerCase().includes(normalizedSearchText) ||
      card.id.toLowerCase().includes(normalizedSearchText),
  );
};

// カード種別による検索
export const filterCardsByKind = (
  cards: readonly Card[],
  kinds: readonly CardKind[],
): readonly Card[] => {
  if (kinds.length === 0) {
    return cards;
  }

  return cards.filter((card) => kinds.some((kind) => kind === card.kind));
};

// カードタイプによる検索
export const filterCardsByType = (
  cards: readonly Card[],
  types: readonly CardType[],
): readonly Card[] => {
  if (types.length === 0) {
    return cards;
  }

  return cards.filter((card) => {
    return types.some((filterType) => card.type.includes(filterType));
  });
};

// タグによる検索
export const filterCardsByTags = (
  cards: readonly Card[],
  tags: readonly string[],
): readonly Card[] => {
  if (tags.length === 0) {
    return cards;
  }

  return cards.filter((card) => tags.every((tag) => hasTag(card, tag)));
};
