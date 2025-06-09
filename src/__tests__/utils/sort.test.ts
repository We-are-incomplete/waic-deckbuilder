import { describe, it, expect } from "vitest";
import {
  createNaturalSort,
  createKindSort,
  createTypeSort,
  createCombinedSort,
  reverseSort,
} from "../../utils/sort";
import type { Card } from "../../types/card";

describe("utils/sort", () => {
  describe("createNaturalSort", () => {
    it("数字を含む文字列を自然順でソートする", () => {
      const naturalSort = createNaturalSort();
      const items = ["a10", "a2", "a1"];
      const sorted = items.sort(naturalSort);
      expect(sorted).toEqual(["a1", "a2", "a10"]);
    });

    it("大文字を小文字より優先してソートする", () => {
      const naturalSort = createNaturalSort();
      const items = ["b", "B", "a", "A"];
      const sorted = items.sort(naturalSort);
      expect(sorted).toEqual(["A", "B", "a", "b"]);
    });

    it("複雑な文字列を正しくソートする", () => {
      const naturalSort = createNaturalSort();
      const items = ["A-001", "a-002", "A-010", "a-001"];
      const sorted = items.sort(naturalSort);
      expect(sorted).toEqual(["A-001", "A-010", "a-001", "a-002"]);
    });

    it("長さの異なる文字列を正しくソートする", () => {
      const naturalSort = createNaturalSort();
      const items = ["abc", "ab", "abcd"];
      const sorted = items.sort(naturalSort);
      expect(sorted).toEqual(["ab", "abc", "abcd"]);
    });

    it("数字のみの文字列を正しくソートする", () => {
      const naturalSort = createNaturalSort();
      const items = ["100", "20", "3"];
      const sorted = items.sort(naturalSort);
      expect(sorted).toEqual(["3", "20", "100"]);
    });

    it("空文字列や特殊文字を含む場合でも動作する", () => {
      const naturalSort = createNaturalSort();
      const items = ["", "a", "1", "-"];
      const sorted = items.sort(naturalSort);
      expect(sorted).toEqual(["", "-", "1", "a"]);
    });
  });

  describe("createKindSort", () => {
    it("カード種別を定義された順序でソートする", () => {
      const kindSort = createKindSort();
      const items: Pick<Card, "kind">[] = [
        { kind: { type: "Direction" } },
        { kind: { type: "Artist" } },
        { kind: { type: "Magic" } },
        { kind: { type: "Song" } },
      ];

      const sorted = items.sort(kindSort);
      expect(sorted).toEqual([
        { kind: { type: "Artist" } },
        { kind: { type: "Song" } },
        { kind: { type: "Magic" } },
        { kind: { type: "Direction" } },
      ]);
    });
  });

  describe("createTypeSort", () => {
    it("カードタイプを定義された順序でソートする", () => {
      const typeSort = createTypeSort();
      const items: Pick<Card, "type">[] = [
        { type: { type: "color", value: "青" } },
        { type: { type: "color", value: "赤" } },
        { type: { type: "installation", value: "設置" } },
        { type: { type: "timing", value: "即時" } },
      ];

      const sorted = items.sort(typeSort);
      expect(sorted).toEqual([
        { type: { type: "color", value: "赤" } },
        { type: { type: "color", value: "青" } },
        { type: { type: "timing", value: "即時" } },
        { type: { type: "installation", value: "設置" } },
      ]);
    });

    it("複数のタイプを持つカードで最初のタイプでソートする", () => {
      const typeSort = createTypeSort();
      const items: Pick<Card, "type">[] = [
        {
          type: [
            { type: "color", value: "青" },
            { type: "timing", value: "即時" },
          ],
        },
        {
          type: [
            { type: "color", value: "赤" },
            { type: "equipment", value: "装備" },
          ],
        },
      ];

      const sorted = items.sort(typeSort);
      expect(sorted[0].type).toEqual([
        { type: "color", value: "赤" },
        { type: "equipment", value: "装備" },
      ]);
      expect(sorted[1].type).toEqual([
        { type: "color", value: "青" },
        { type: "timing", value: "即時" },
      ]);
    });
  });

  describe("createCombinedSort", () => {
    it("複数のソート条件を組み合わせて適用する", () => {
      type TestItem = { name: string; id: number };
      const stringSort = (a: TestItem, b: TestItem) =>
        a.name.localeCompare(b.name);
      const numberSort = (a: TestItem, b: TestItem) => a.id - b.id;
      const combinedSort = createCombinedSort(stringSort, numberSort);

      const items: TestItem[] = [
        { name: "B", id: 2 },
        { name: "A", id: 2 },
        { name: "A", id: 1 },
      ];

      const sorted = items.sort(combinedSort);
      expect(sorted).toEqual([
        { name: "A", id: 1 },
        { name: "A", id: 2 },
        { name: "B", id: 2 },
      ]);
    });

    it("最初の条件で順序が決まらない場合は次の条件を適用する", () => {
      const sameResult = () => 0;
      const naturalSort = createNaturalSort();
      const combinedSort = createCombinedSort(sameResult, naturalSort);

      const items = ["b", "a"];
      const sorted = items.sort(combinedSort);
      expect(sorted).toEqual(["a", "b"]);
    });
  });

  describe("reverseSort", () => {
    it("ソート順を逆にする", () => {
      const naturalSort = createNaturalSort();
      const reversedSort = reverseSort(naturalSort);

      const items = ["a", "b", "c"];
      const sorted = items.sort(reversedSort);
      expect(sorted).toEqual(["c", "b", "a"]);
    });

    it("数値ソートの逆順も正しく動作する", () => {
      const naturalSort = createNaturalSort();
      const reversedSort = reverseSort(naturalSort);

      const items = ["1", "10", "2"];
      const sorted = items.sort(reversedSort);
      expect(sorted).toEqual(["10", "2", "1"]);
    });
  });
});
