/**
 * @file カードのドメインロジックを定義する。
 *
 * このファイルでは、カードの作成、検索、フィルタリングに関する純粋関数を提供する。
 * - カードのバリデーションと生成
 * - カード名、種別、タイプ、タグによるフィルタリング
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 * - エラーハンドリングにはEffectのEffect型を使用し、例外をスローしない
 */
import { Effect, Data } from "effect";
import type { Card, CardKind, CardType } from "../types";
import { CARD_KINDS, CARD_TYPES } from "../constants";

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
export class CardValidationError extends Data.TaggedError(
  "CardValidationError",
)<{
  readonly type:
    | "InvalidId"
    | "InvalidName"
    | "InvalidKind"
    | "InvalidType"
    | "EmptyTypeList"
    | "DuplicateTypes"
    | "DuplicateTags";
  readonly value?: string | readonly string[];
}> {}

// カード作成関数
export const createCard = (
  id: string,
  name: string,
  kind: CardKind,
  type: readonly CardType[],
  tags?: readonly string[],
): Effect.Effect<Card, CardValidationError> => {
  // ID検証
  if (!id || id.trim().length === 0) {
    return Effect.fail(
      new CardValidationError({ type: "InvalidId", value: id }),
    );
  }

  // 名前検証
  if (!name || name.trim().length === 0) {
    return Effect.fail(
      new CardValidationError({ type: "InvalidName", value: name }),
    );
  }

  // 種別検証（実行時）
  if (!CARD_KINDS.includes(kind)) {
    return Effect.fail(
      new CardValidationError({ type: "InvalidKind", value: kind }),
    );
  }

  // 空配列/重複チェック
  if (type.length === 0)
    return Effect.fail(new CardValidationError({ type: "EmptyTypeList" }));
  if (new Set(type).size !== type.length)
    return Effect.fail(
      new CardValidationError({ type: "DuplicateTypes", value: type }),
    );

  // タイプ検証（実行時）
  for (const t of type) {
    if (!CARD_TYPES.includes(t)) {
      return Effect.fail(
        new CardValidationError({ type: "InvalidType", value: t }),
      );
    }
  }

  // タグ検証
  let finalTags: readonly string[] | undefined = undefined;
  const processedTags = tags
    ?.map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (processedTags && processedTags.length > 0) {
    const uniqueTags = new Set(processedTags);
    if (uniqueTags.size !== processedTags.length) {
      return Effect.fail(
        new CardValidationError({
          type: "DuplicateTags",
          value: processedTags,
        }),
      );
    }
    finalTags = [...uniqueTags];
  }

  return Effect.succeed({
    id: id.trim(),
    name: name.trim(),
    kind,
    type,
    tags: finalTags,
  });
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
