import { describe, it, expect } from "vitest";
import {
  applyFilter,
  createFilterResult,
  combineFilters,
  createTextFilter,
  createKindFilter,
  createTypeFilter,
  createTagFilter,
  isEmptyFilter,
  canApplyFilter,
} from "../../domain/filter";
import type { Card, CardKind, CardType } from "../../types/card";
import type { FilterCondition } from "../../types/filter";

describe("domain/filter", () => {
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
  const redType: CardType = { type: "color", value: "赤" };
  const blueType: CardType = { type: "color", value: "青" };

  const testCards: Card[] = [
    createTestCard({
      id: "001",
      name: "ホロライブアーティスト",
      kind: artistKind,
      type: redType,
      tags: ["ホロライブ", "VTuber"],
    }),
    createTestCard({
      id: "002",
      name: "にじさんじソング",
      kind: songKind,
      type: blueType,
      tags: ["にじさんじ", "VTuber"],
    }),
    createTestCard({
      id: "003",
      name: "個人勢カード",
      kind: artistKind,
      type: redType,
      tags: ["個人勢"],
    }),
  ];

  describe("applyFilter", () => {
    it("テキストフィルターを適用できる", () => {
      const textFilter: FilterCondition = {
        type: "text",
        value: "ホロライブ",
      };

      const result = applyFilter(testCards, textFilter);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ホロライブアーティスト");
    });

    it("種別フィルターを適用できる", () => {
      const kindFilter: FilterCondition = {
        type: "kind",
        values: [songKind],
      };

      const result = applyFilter(testCards, kindFilter);

      expect(result).toHaveLength(1);
      expect(result[0].kind.type).toBe("Song");
    });

    it("タイプフィルターを適用できる", () => {
      const typeFilter: FilterCondition = {
        type: "cardType",
        values: [redType],
      };

      const result = applyFilter(testCards, typeFilter);

      expect(result).toHaveLength(2);
      expect(
        result.every((card) => {
          const cardTypes = Array.isArray(card.type) ? card.type : [card.type];
          return cardTypes.some(
            (type) => type.type === "color" && type.value === "赤"
          );
        })
      ).toBe(true);
    });

    it("タグフィルターを適用できる", () => {
      const tagFilter: FilterCondition = {
        type: "tags",
        values: ["VTuber"],
      };

      const result = applyFilter(testCards, tagFilter);

      expect(result).toHaveLength(2);
      expect(result.every((card) => card.tags?.includes("VTuber"))).toBe(true);
    });

    it("複合フィルターを適用できる", () => {
      const combinedFilter: FilterCondition = {
        type: "combined",
        conditions: [
          { type: "tags", values: ["VTuber"] },
          { type: "kind", values: [artistKind] },
        ],
      };

      const result = applyFilter(testCards, combinedFilter);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ホロライブアーティスト");
    });
  });

  describe("createFilterResult", () => {
    it("フィルター結果を正しく作成する", () => {
      const allItems = [1, 2, 3, 4, 5];
      const filteredItems = [2, 4];

      const result = createFilterResult(allItems, filteredItems);

      expect(result).toEqual({
        items: filteredItems,
        totalCount: 5,
        filteredCount: 2,
      });
    });

    it("空の結果を正しく作成する", () => {
      const allItems = [1, 2, 3];
      const filteredItems: number[] = [];

      const result = createFilterResult(allItems, filteredItems);

      expect(result).toEqual({
        items: [],
        totalCount: 3,
        filteredCount: 0,
      });
    });
  });

  describe("combineFilters", () => {
    it("複数のフィルター条件を組み合わせる", () => {
      const conditions: FilterCondition[] = [
        { type: "text", value: "テスト" },
        { type: "kind", values: [artistKind] },
      ];

      const result = combineFilters(conditions);

      expect(result).toEqual({
        type: "combined",
        conditions,
      });
    });

    it("空の条件配列を組み合わせる", () => {
      const result = combineFilters([]);

      expect(result).toEqual({
        type: "combined",
        conditions: [],
      });
    });
  });

  describe("フィルター条件作成関数", () => {
    it("createTextFilter - テキストフィルター条件を作成する", () => {
      const result = createTextFilter("検索テキスト");

      expect(result).toEqual({
        type: "text",
        value: "検索テキスト",
      });
    });

    it("createKindFilter - 種別フィルター条件を作成する", () => {
      const kinds = [artistKind, songKind];
      const result = createKindFilter(kinds);

      expect(result).toEqual({
        type: "kind",
        values: kinds,
      });
    });

    it("createTypeFilter - タイプフィルター条件を作成する", () => {
      const types = [redType, blueType];
      const result = createTypeFilter(types);

      expect(result).toEqual({
        type: "cardType",
        values: types,
      });
    });

    it("createTagFilter - タグフィルター条件を作成する", () => {
      const tags = ["タグ1", "タグ2"];
      const result = createTagFilter(tags);

      expect(result).toEqual({
        type: "tags",
        values: tags,
      });
    });
  });

  describe("isEmptyFilter", () => {
    it("空のテキストフィルターを正しく判定する", () => {
      expect(isEmptyFilter({ type: "text", value: "" })).toBe(true);
      expect(isEmptyFilter({ type: "text", value: "   " })).toBe(true);
      expect(isEmptyFilter({ type: "text", value: "テスト" })).toBe(false);
    });

    it("空の種別フィルターを正しく判定する", () => {
      expect(isEmptyFilter({ type: "kind", values: [] })).toBe(true);
      expect(isEmptyFilter({ type: "kind", values: [artistKind] })).toBe(false);
    });

    it("空のタイプフィルターを正しく判定する", () => {
      expect(isEmptyFilter({ type: "cardType", values: [] })).toBe(true);
      expect(isEmptyFilter({ type: "cardType", values: [redType] })).toBe(
        false
      );
    });

    it("空のタグフィルターを正しく判定する", () => {
      expect(isEmptyFilter({ type: "tags", values: [] })).toBe(true);
      expect(isEmptyFilter({ type: "tags", values: ["タグ"] })).toBe(false);
    });

    it("空の複合フィルターを正しく判定する", () => {
      const emptyConditions: FilterCondition[] = [
        { type: "text", value: "" },
        { type: "kind", values: [] },
      ];
      const nonEmptyConditions: FilterCondition[] = [
        { type: "text", value: "テスト" },
        { type: "kind", values: [] },
      ];

      expect(isEmptyFilter({ type: "combined", conditions: [] })).toBe(true);
      expect(
        isEmptyFilter({ type: "combined", conditions: emptyConditions })
      ).toBe(true);
      expect(
        isEmptyFilter({ type: "combined", conditions: nonEmptyConditions })
      ).toBe(false);
    });
  });

  describe("canApplyFilter", () => {
    it("カードがある場合かつ空でないフィルターで true を返す", () => {
      const condition: FilterCondition = {
        type: "text",
        value: "テスト",
      };

      const result = canApplyFilter(testCards, condition);

      expect(result).toBe(true);
    });

    it("カードが空の場合は false を返す", () => {
      const condition: FilterCondition = {
        type: "text",
        value: "テスト",
      };

      const result = canApplyFilter([], condition);

      expect(result).toBe(false);
    });

    it("フィルターが空の場合は false を返す", () => {
      const condition: FilterCondition = {
        type: "text",
        value: "",
      };

      const result = canApplyFilter(testCards, condition);

      expect(result).toBe(false);
    });
  });
});
