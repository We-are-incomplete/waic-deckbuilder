import { describe, it, expect } from "vitest";
import {
  createCard,
  isArtist,
  isSong,
  isMagic,
  isDirection,
  hasColor,
  hasTag,
  searchCardsByName,
  filterCardsByKind,
  filterCardsByType,
  filterCardsByTags,
} from "../../domain/card";
import type { Card, CardKind, CardType } from "../../types/card";

describe("domain/card", () => {
  // テスト用のカードデータ
  const createTestCard = (overrides: Partial<Card> = {}): Card => ({
    id: "test-001",
    name: "テストカード",
    kind: { type: "Artist" },
    type: { type: "color", value: "赤" },
    tags: ["テスト"],
    ...overrides,
  });

  const artistKind: CardKind = { type: "Artist" };
  const songKind: CardKind = { type: "Song" };
  const magicKind: CardKind = { type: "Magic" };
  const directionKind: CardKind = { type: "Direction" };

  const redType: CardType = { type: "color", value: "赤" };
  const blueType: CardType = { type: "color", value: "青" };
  const immediateType: CardType = { type: "timing", value: "即時" };

  describe("createCard", () => {
    it("正常なカードを作成できる", () => {
      const result = createCard(
        "card-001",
        "テストカード",
        artistKind,
        redType,
        ["タグ1"]
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          id: "card-001",
          name: "テストカード",
          kind: artistKind,
          type: redType,
          tags: ["タグ1"],
        });
      }
    });

    it("IDが空の場合はエラーを返す", () => {
      const result = createCard("", "テストカード", artistKind, redType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toEqual({
          type: "invalidId",
          id: "",
        });
      }
    });

    it("IDが空白のみの場合はエラーを返す", () => {
      const result = createCard("   ", "テストカード", artistKind, redType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("invalidId");
      }
    });

    it("名前が空の場合はエラーを返す", () => {
      const result = createCard("card-001", "", artistKind, redType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toEqual({
          type: "invalidName",
          name: "",
        });
      }
    });

    it("名前が空白のみの場合はエラーを返す", () => {
      const result = createCard("card-001", "   ", artistKind, redType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("invalidName");
      }
    });

    it("重複するタグがある場合はエラーを返す", () => {
      const result = createCard(
        "card-001",
        "テストカード",
        artistKind,
        redType,
        ["タグ1", "タグ1"]
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toEqual({
          type: "duplicateTags",
          tags: ["タグ1", "タグ1"],
        });
      }
    });

    it("前後の空白を除去する", () => {
      const result = createCard(
        "  card-001  ",
        "  テストカード  ",
        artistKind,
        redType,
        ["  タグ1  ", "タグ2"]
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("card-001");
        expect(result.value.name).toBe("テストカード");
        expect(result.value.tags).toEqual(["タグ1", "タグ2"]);
      }
    });

    it("空のタグを除去する", () => {
      const result = createCard(
        "card-001",
        "テストカード",
        artistKind,
        redType,
        ["タグ1", "", "  ", "タグ2"]
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.tags).toEqual(["タグ1", "タグ2"]);
      }
    });

    it("タグなしの場合はundefinedになる", () => {
      const result = createCard(
        "card-001",
        "テストカード",
        artistKind,
        redType
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.tags).toBeUndefined();
      }
    });
  });

  describe("カード種別判定関数", () => {
    it("isArtist - アーティストカードを正しく判定する", () => {
      const artistCard = createTestCard({ kind: artistKind });
      const songCard = createTestCard({ kind: songKind });

      expect(isArtist(artistCard)).toBe(true);
      expect(isArtist(songCard)).toBe(false);
    });

    it("isSong - ソングカードを正しく判定する", () => {
      const songCard = createTestCard({ kind: songKind });
      const artistCard = createTestCard({ kind: artistKind });

      expect(isSong(songCard)).toBe(true);
      expect(isSong(artistCard)).toBe(false);
    });

    it("isMagic - マジックカードを正しく判定する", () => {
      const magicCard = createTestCard({ kind: magicKind });
      const artistCard = createTestCard({ kind: artistKind });

      expect(isMagic(magicCard)).toBe(true);
      expect(isMagic(artistCard)).toBe(false);
    });

    it("isDirection - ディレクションカードを正しく判定する", () => {
      const directionCard = createTestCard({ kind: directionKind });
      const artistCard = createTestCard({ kind: artistKind });

      expect(isDirection(directionCard)).toBe(true);
      expect(isDirection(artistCard)).toBe(false);
    });
  });

  describe("hasColor", () => {
    it("指定された色を持つカードを正しく判定する", () => {
      const redCard = createTestCard({ type: redType });
      const blueCard = createTestCard({ type: blueType });

      expect(hasColor(redCard, "赤")).toBe(true);
      expect(hasColor(redCard, "青")).toBe(false);
      expect(hasColor(blueCard, "青")).toBe(true);
      expect(hasColor(blueCard, "赤")).toBe(false);
    });

    it("複数のタイプを持つカードで色を正しく判定する", () => {
      const multiTypeCard = createTestCard({ type: [redType, immediateType] });

      expect(hasColor(multiTypeCard, "赤")).toBe(true);
      expect(hasColor(multiTypeCard, "青")).toBe(false);
    });
  });

  describe("hasTag", () => {
    it("指定されたタグを持つカードを正しく判定する", () => {
      const taggedCard = createTestCard({ tags: ["タグ1", "タグ2"] });
      const noTagCard = createTestCard({ tags: undefined });

      expect(hasTag(taggedCard, "タグ1")).toBe(true);
      expect(hasTag(taggedCard, "タグ3")).toBe(false);
      expect(hasTag(noTagCard, "タグ1")).toBe(false);
    });
  });

  describe("searchCardsByName", () => {
    const cards: Card[] = [
      createTestCard({ id: "001", name: "ホロライブ" }),
      createTestCard({ id: "002", name: "にじさんじ" }),
      createTestCard({ id: "003", name: "個人勢" }),
    ];

    it("名前でカードを検索できる", () => {
      const result = searchCardsByName(cards, "ホロ");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ホロライブ");
    });

    it("IDでカードを検索できる", () => {
      const result = searchCardsByName(cards, "002");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("002");
    });

    it("大文字小文字を区別しない", () => {
      const result = searchCardsByName(cards, "ホロ");
      expect(result).toHaveLength(1);
    });

    it("空の検索テキストの場合は全てのカードを返す", () => {
      const result = searchCardsByName(cards, "");
      expect(result).toHaveLength(3);
    });

    it("マッチしない場合は空配列を返す", () => {
      const result = searchCardsByName(cards, "存在しない");
      expect(result).toHaveLength(0);
    });
  });

  describe("filterCardsByKind", () => {
    const cards: Card[] = [
      createTestCard({ kind: artistKind }),
      createTestCard({ kind: songKind }),
      createTestCard({ kind: magicKind }),
    ];

    it("指定された種別のカードのみを返す", () => {
      const result = filterCardsByKind(cards, [artistKind, songKind]);
      expect(result).toHaveLength(2);
      expect(result.every((card) => isArtist(card) || isSong(card))).toBe(true);
    });

    it("空の種別配列の場合は全てのカードを返す", () => {
      const result = filterCardsByKind(cards, []);
      expect(result).toHaveLength(3);
    });
  });

  describe("filterCardsByType", () => {
    const cards: Card[] = [
      createTestCard({ type: redType }),
      createTestCard({ type: blueType }),
      createTestCard({ type: immediateType }),
    ];

    it("指定されたタイプのカードのみを返す", () => {
      const result = filterCardsByType(cards, [redType]);
      expect(result).toHaveLength(1);
      expect(hasColor(result[0], "赤")).toBe(true);
    });

    it("複数のタイプでフィルタできる", () => {
      const result = filterCardsByType(cards, [redType, blueType]);
      expect(result).toHaveLength(2);
    });

    it("空のタイプ配列の場合は全てのカードを返す", () => {
      const result = filterCardsByType(cards, []);
      expect(result).toHaveLength(3);
    });
  });

  describe("filterCardsByTags", () => {
    const cards: Card[] = [
      createTestCard({ tags: ["タグ1", "タグ2"] }),
      createTestCard({ tags: ["タグ2", "タグ3"] }),
      createTestCard({ tags: undefined }),
    ];

    it("指定されたタグを持つカードのみを返す", () => {
      const result = filterCardsByTags(cards, ["タグ1"]);
      expect(result).toHaveLength(1);
    });

    it("複数のタグのいずれかを持つカードを返す", () => {
      const result = filterCardsByTags(cards, ["タグ1", "タグ3"]);
      expect(result).toHaveLength(2);
    });

    it("空のタグ配列の場合は全てのカードを返す", () => {
      const result = filterCardsByTags(cards, []);
      expect(result).toHaveLength(3);
    });
  });
});
