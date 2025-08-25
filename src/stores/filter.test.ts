import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFilterStore } from "./filter";
import { useCardsStore } from "./cards";
import type { Card } from "../types/card";

// モックデータ
const mockCards: Card[] = [
  {
    id: "card1",
    name: "Card A",
    kind: "Artist",
    type: ["赤"],
    effect: "【登場時効果】何か。【登場条件】ステージに特定のカードがある場合。",
    hasEntryCondition: true,
  },
  {
    id: "card2",
    name: "Card B",
    kind: "Song",
    type: ["青"],
    effect: "【登場時効果】別の何か。",
    hasEntryCondition: false,
  },
  {
    id: "card3",
    name: "Card C",
    kind: "Magic",
    type: ["黄"],
    effect: "【特殊能力】さらに何か。【登場条件】魔力が3個以上ある場合。",
    hasEntryCondition: true,
  },
  {
    id: "card4",
    name: "Card D",
    kind: "Direction",
    type: ["白"],
    effect: "【永続効果】常に何か。",
    hasEntryCondition: false,
  },
];

// useCardsStoreをモック化
vi.mock("./cards", () => ({
  useCardsStore: vi.fn(() => ({
    availableCards: mockCards,
    // sortedAndFilteredCardsはfilterStoreが参照するので、ここではモックしない
  })),
}));

describe("filterStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // useCardsStoreのモックをリセット
    vi.mocked(useCardsStore).mockClear();
    vi.mocked(useCardsStore).mockReturnValue({
      availableCards: mockCards,
      // sortedAndFilteredCardsはfilterStoreが参照するので、ここではモックしない
    } as any);
  });

  it("should initialize with default filter criteria", () => {
    const store = useFilterStore();
    expect(store.filterCriteria.text).toBe("");
    expect(store.filterCriteria.kind).toEqual([]);
    expect(store.filterCriteria.type).toEqual([]);
    expect(store.filterCriteria.tags).toEqual([]);
    expect(store.filterCriteria.hasEntryCondition).toBe(false);
  });

  it("should toggle hasEntryCondition filter", () => {
    const store = useFilterStore();
    expect(store.filterCriteria.hasEntryCondition).toBe(false);

    store.toggleEntryConditionFilter();
    expect(store.filterCriteria.hasEntryCondition).toBe(true);

    store.toggleEntryConditionFilter();
    expect(store.filterCriteria.hasEntryCondition).toBe(false);
  });

  it("should filter cards by hasEntryCondition", () => {
    const store = useFilterStore();

    // hasEntryConditionがfalseの場合、全てのカードが表示される
    expect(store.sortedAndFilteredCards.length).toBe(mockCards.length);

    // hasEntryConditionをtrueに設定
    store.toggleEntryConditionFilter();
    expect(store.filterCriteria.hasEntryCondition).toBe(true);

    // 【登場条件】を持つカードのみがフィルタリングされることを確認
    const filtered = store.sortedAndFilteredCards;
    expect(filtered.length).toBe(2);
    expect(filtered.some((card) => card.id === "card1")).toBe(true);
    expect(filtered.some((card) => card.id === "card3")).toBe(true);
    expect(filtered.some((card) => card.id === "card2")).toBe(false);
    expect(filtered.some((card) => card.id === "card4")).toBe(false);
  });

  it("should reset hasEntryCondition filter", () => {
    const store = useFilterStore();

    store.toggleEntryConditionFilter();
    expect(store.filterCriteria.hasEntryCondition).toBe(true);

    store.resetFilterCriteria();
    expect(store.filterCriteria.hasEntryCondition).toBe(false);
    expect(store.sortedAndFilteredCards.length).toBe(mockCards.length); // 全てのフィルターがリセットされるため
  });

  it("should correctly identify empty filter criteria", () => {
    const store = useFilterStore();
    expect(store.isEmptyFilter).toBe(true);

    store.setTextFilter("test");
    expect(store.isEmptyFilter).toBe(false);
    store.setTextFilter("");
    expect(store.isEmptyFilter).toBe(true);

    store.toggleEntryConditionFilter();
    expect(store.isEmptyFilter).toBe(false);
    store.toggleEntryConditionFilter();
    expect(store.isEmptyFilter).toBe(true);

    store.toggleKindFilter("Artist");
    expect(store.isEmptyFilter).toBe(false);
    store.resetFilterCriteria();
    expect(store.isEmptyFilter).toBe(true);
  });
});
