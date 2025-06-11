/**
 * @file カードのドメインロジックを定義する。
 *
 * このファイルでは、カードの作成、検索、フィルタリングに関する純粋関数を提供する。
 * - カードのバリデーションと生成
 * - カード名、種別、タイプ、タグによるフィルタリング
 * - 副作用を避け、不変データ構造を優先する関数型アプローチを採用
 * - エラーハンドリングにはneverthrowのResult型を使用し、例外をスローしない
 */
import { ok, err, type Result } from "neverthrow";
import type { Card, CardKind, CardType } from "../types/card";

// カード検証エラー型
export type CardValidationError =
  | { readonly type: "invalidId"; readonly id: string }
  | { readonly type: "invalidName"; readonly name: string }
  | { readonly type: "invalidKind"; readonly kind: CardKind }
  | {
      readonly type: "invalidType";
      readonly cardType: CardType | readonly CardType[];
    }
  | { readonly type: "duplicateTags"; readonly tags: readonly string[] };

// カード作成関数
export const createCard = (
  id: string,
  name: string,
  kind: CardKind,
  type: CardType | readonly CardType[],
  tags?: readonly string[]
): Result<Card, CardValidationError> => {
  // ID検証
  if (!id || id.trim().length === 0) {
    return err({ type: "invalidId", id });
  }

  // 名前検証
  if (!name || name.trim().length === 0) {
    return err({ type: "invalidName", name });
  }

  // タグ検証
  const processedTags = tags
    ?.map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (processedTags && processedTags.length > 0) {
    const uniqueTags = new Set(processedTags);
    if (uniqueTags.size !== processedTags.length) {
      return err({ type: "duplicateTags", tags: processedTags });
    }
    // Setから配列に変換し、undefinedの場合はundefinedを維持
    return ok({
      id: id.trim(),
      name: name.trim(),
      kind,
      type,
      tags: [...uniqueTags],
    });
  }

  // タグがない場合、または処理後にタグが空になった場合
  return ok({
    id: id.trim(),
    name: name.trim(),
    kind,
    type,
    tags: processedTags && processedTags.length > 0 ? processedTags : undefined,
  });
};

// カードが特定のタグを持つかチェック
export const hasTag = (card: Card, tag: string): boolean => {
  return card.tags?.includes(tag) ?? false;
};

// カード名による検索
export const searchCardsByName = (
  cards: readonly Card[],
  searchText: string
): readonly Card[] => {
  if (!searchText || searchText.trim().length === 0) {
    return cards;
  }

  const normalizedSearchText = searchText.trim().toLowerCase();
  return cards.filter(
    (card) =>
      card.name.toLowerCase().includes(normalizedSearchText) ||
      card.id.toLowerCase().includes(normalizedSearchText)
  );
};

// カード種別による検索
export const filterCardsByKind = (
  cards: readonly Card[],
  kinds: readonly CardKind[]
): readonly Card[] => {
  if (kinds.length === 0) {
    return cards;
  }

  return cards.filter((card) =>
    kinds.some((kind) => kind.type === card.kind.type)
  );
};

// カードタイプがフィルタータイプに一致するかをチェックするヘルパー関数
// 色タイプの場合のみ、値も一致する必要がある
const isCardTypeMatchingFilterType = (
  cardType: CardType,
  filterType: CardType
): boolean => {
  return (
    cardType.type === filterType.type &&
    (cardType.type !== "color" || cardType.value === filterType.value)
  );
};

// カードタイプによる検索
export const filterCardsByType = (
  cards: readonly Card[],
  types: readonly CardType[]
): readonly Card[] => {
  if (types.length === 0) {
    return cards;
  }

  return cards.filter((card) => {
    const cardTypes = Array.isArray(card.type) ? card.type : [card.type];
    return types.some((filterType) =>
      cardTypes.some((cardType) =>
        isCardTypeMatchingFilterType(cardType, filterType)
      )
    );
  });
};

// タグによる検索
export const filterCardsByTags = (
  cards: readonly Card[],
  tags: readonly string[]
): readonly Card[] => {
  if (tags.length === 0) {
    return cards;
  }

  return cards.filter((card) => tags.some((tag) => hasTag(card, tag)));
};
