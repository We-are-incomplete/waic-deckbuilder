import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDeckStore } from "../../stores/deck";
import { useCardsStore } from "../../stores/cards";
import { useFilterStore } from "../../stores/filter";
import type { Card } from "../../types";

// テスト用のモックデータ
const mockCards: Card[] = [
  {
    id: "card-001",
    name: "ファイア・スペル",
    kind: { type: "Magic" },
    type: { type: "color", value: "赤" },
    tags: ["火", "攻撃"],
  },
  {
    id: "card-002",
    name: "ヒール・スペル",
    kind: { type: "Magic" },
    type: { type: "color", value: "白" },
    tags: ["光", "回復"],
  },
  {
    id: "card-003",
    name: "ナイト",
    kind: { type: "Artist" },
    type: { type: "color", value: "黄" },
    tags: ["人間", "戦士"],
  },
  {
    id: "card-004",
    name: "ドラゴン",
    kind: { type: "Artist" },
    type: { type: "color", value: "赤" },
    tags: ["ドラゴン", "飛行"],
  },
];

describe("デッキ構築統合テスト", () => {
  let deckStore: ReturnType<typeof useDeckStore>;
  let cardsStore: ReturnType<typeof useCardsStore>;
  let filterStore: ReturnType<typeof useFilterStore>;

  beforeEach(() => {
    // Piniaの初期化
    setActivePinia(createPinia());

    // ストアのインスタンス化
    deckStore = useDeckStore();
    cardsStore = useCardsStore();
    filterStore = useFilterStore();

    // カードストアにモックデータを設定
    cardsStore.availableCards = mockCards;
  });

  describe("基本的なデッキ構築フロー", () => {
    it("カードをデッキに追加できる", () => {
      const card = mockCards[0];

      // 初期状態の確認
      expect(deckStore.deckCards).toHaveLength(0);
      expect(deckStore.totalDeckCards).toBe(0);

      // カードを追加
      deckStore.addCardToDeck(card);

      // 結果の確認
      expect(deckStore.deckCards).toHaveLength(1);
      expect(deckStore.deckCards[0].card.id).toBe(card.id);
      expect(deckStore.deckCards[0].count).toBe(1);
      expect(deckStore.totalDeckCards).toBe(1);
    });

    it("同じカードを複数枚追加できる", () => {
      const card = mockCards[0];

      // 3回追加
      deckStore.addCardToDeck(card);
      deckStore.addCardToDeck(card);
      deckStore.addCardToDeck(card);

      // 結果の確認
      expect(deckStore.deckCards).toHaveLength(1);
      expect(deckStore.deckCards[0].count).toBe(3);
      expect(deckStore.totalDeckCards).toBe(3);
    });

    it("最大枚数制限を超えて追加しようとするとエラーハンドリングされる", () => {
      const card = mockCards[0];

      // モックトースト関数を設定
      const mockToast = vi.fn();
      deckStore.setToastFunction(mockToast);

      // 最大枚数（3枚）を追加
      deckStore.addCardToDeck(card);
      deckStore.addCardToDeck(card);
      deckStore.addCardToDeck(card);

      // 4枚目を追加しようとする
      deckStore.addCardToDeck(card);

      // 結果の確認
      expect(deckStore.deckCards[0].count).toBe(3); // 3枚のまま
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("最大枚数"),
        "error"
      );
    });

    it("複数の異なるカードを追加できる", () => {
      // 異なるカードを追加
      deckStore.addCardToDeck(mockCards[0]);
      deckStore.addCardToDeck(mockCards[1]);
      deckStore.addCardToDeck(mockCards[2]);

      // 結果の確認
      expect(deckStore.deckCards).toHaveLength(3);
      expect(deckStore.totalDeckCards).toBe(3);

      const cardIds = deckStore.deckCards.map((dc) => dc.card.id);
      expect(cardIds).toContain("card-001");
      expect(cardIds).toContain("card-002");
      expect(cardIds).toContain("card-003");
    });
  });

  describe("デッキ操作機能", () => {
    beforeEach(() => {
      // 基本のデッキを準備
      deckStore.addCardToDeck(mockCards[0]); // ファイア・スペル x1
      deckStore.addCardToDeck(mockCards[0]); // ファイア・スペル x2
      deckStore.addCardToDeck(mockCards[1]); // ヒール・スペル x1
    });

    it("カードのカウントを増やせる", () => {
      const cardId = mockCards[0].id;

      // カウント増加
      deckStore.incrementCardCount(cardId);

      // 結果の確認
      const fireSpellCard = deckStore.deckCards.find(
        (dc) => dc.card.id === cardId
      );
      expect(fireSpellCard?.count).toBe(3);
      expect(deckStore.totalDeckCards).toBe(4);
    });

    it("カードのカウントを減らせる", () => {
      const cardId = mockCards[0].id;

      // カウント減少
      deckStore.decrementCardCount(cardId);

      // 結果の確認
      const fireSpellCard = deckStore.deckCards.find(
        (dc) => dc.card.id === cardId
      );
      expect(fireSpellCard?.count).toBe(1);
      expect(deckStore.totalDeckCards).toBe(2);
    });

    it("カウントが1の時に減らすとカードが削除される", () => {
      const cardId = mockCards[1].id; // ヒール・スペル（1枚のみ）

      // カウント減少
      deckStore.decrementCardCount(cardId);

      // 結果の確認
      expect(deckStore.deckCards).toHaveLength(1); // ファイア・スペルのみ残る
      expect(deckStore.totalDeckCards).toBe(2);

      const healSpellCard = deckStore.deckCards.find(
        (dc) => dc.card.id === cardId
      );
      expect(healSpellCard).toBeUndefined();
    });

    it("カードを完全に削除できる", () => {
      const cardId = mockCards[0].id;

      // カード削除
      deckStore.removeCardFromDeck(cardId);

      // 結果の確認
      expect(deckStore.deckCards).toHaveLength(1); // ヒール・スペルのみ残る
      expect(deckStore.totalDeckCards).toBe(1);

      const fireSpellCard = deckStore.deckCards.find(
        (dc) => dc.card.id === cardId
      );
      expect(fireSpellCard).toBeUndefined();
    });

    it("デッキをリセットできる", () => {
      // デッキリセット
      deckStore.resetDeckCards();

      // 結果の確認
      expect(deckStore.deckCards).toHaveLength(0);
      expect(deckStore.totalDeckCards).toBe(0);
    });
  });

  describe("デッキバリデーション", () => {
    it("空のデッキは有効", () => {
      const state = deckStore.deckState;
      expect(state.type).toBe("empty");
    });

    it("60枚以下のデッキは有効", () => {
      // 30枚のデッキを作成
      for (let i = 0; i < 30; i++) {
        deckStore.addCardToDeck(mockCards[i % mockCards.length]);
      }

      const state = deckStore.deckState;
      expect(state.type).toBe("valid");
      if (state.type === "valid") {
        expect(state.totalCount).toBe(30);
      }
    });

    it("60枚ちょうどのデッキは有効", () => {
      // 60枚のデッキを作成
      for (let i = 0; i < 60; i++) {
        deckStore.addCardToDeck(mockCards[i % mockCards.length]);
      }

      const state = deckStore.deckState;
      expect(state.type).toBe("valid");
      if (state.type === "valid") {
        expect(state.totalCount).toBe(60);
      }
    });

    it("60枚を超えるデッキは無効", () => {
      // 65枚のデッキを作成
      for (let i = 0; i < 65; i++) {
        deckStore.addCardToDeck(mockCards[i % mockCards.length]);
      }

      const state = deckStore.deckState;
      expect(state.type).toBe("invalid");
      if (state.type === "invalid") {
        expect(state.totalCount).toBe(65);
        expect(state.errors).toContain(expect.stringContaining("60枚"));
      }
    });
  });

  describe("フィルター機能統合", () => {
    it("テキストフィルターでカードを絞り込める", () => {
      // フィルター設定
      filterStore.setTextFilter("ファイア");

      // 結果の確認
      const filtered = filterStore.sortedAndFilteredCards;
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("card-001");
    });

    it("種別フィルターでカードを絞り込める", () => {
      // 魔法カードでフィルター
      filterStore.toggleKindFilter("Magic");

      // 結果の確認
      const filtered = filterStore.sortedAndFilteredCards;
      expect(filtered).toHaveLength(2);
      expect(filtered.every((card) => card.kind.type === "Magic")).toBe(true);
    });

    it("タイプフィルターでカードを絞り込める", () => {
      // 攻撃カードでフィルター
      filterStore.toggleTypeFilter("攻撃");

      // 結果の確認
      const filtered = filterStore.sortedAndFilteredCards;
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("card-001");
    });

    it("タグフィルターでカードを絞り込める", () => {
      // 火タグでフィルター
      filterStore.toggleTagFilter("火");

      // 結果の確認
      const filtered = filterStore.sortedAndFilteredCards;
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("card-001");
    });

    it("複数条件でフィルタリングできる", () => {
      // 魔法かつ火タグでフィルター
      filterStore.toggleKindFilter("Magic");
      filterStore.toggleTagFilter("火");

      // 結果の確認
      const filtered = filterStore.sortedAndFilteredCards;
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("card-001");
      expect(filtered[0].kind.type).toBe("Magic");
      expect(filtered[0].tags).toContain("火");
    });

    it("フィルター統計が正しく計算される", () => {
      // フィルター適用前
      let stats = filterStore.filterStats;
      expect(stats.totalCount).toBe(4);
      expect(stats.filteredCount).toBe(4);
      expect(stats.hasFilter).toBe(false);

      // フィルター適用
      filterStore.toggleKindFilter("Magic");

      stats = filterStore.filterStats;
      expect(stats.totalCount).toBe(4);
      expect(stats.filteredCount).toBe(2);
      expect(stats.hasFilter).toBe(true);
      expect(stats.filterRate).toBe(0.5);
    });

    it("フィルターをリセットできる", () => {
      // フィルター適用
      filterStore.setTextFilter("ファイア");
      filterStore.toggleKindFilter("Magic");
      filterStore.toggleTagFilter("火");

      // リセット
      filterStore.resetFilterCriteria();

      // 結果の確認
      const criteria = filterStore.filterCriteria;
      expect(criteria.text).toBe("");
      expect(criteria.kind).toHaveLength(0);
      expect(criteria.type).toHaveLength(0);
      expect(criteria.tags).toHaveLength(0);

      const filtered = filterStore.sortedAndFilteredCards;
      expect(filtered).toHaveLength(4);
    });
  });

  describe("ソート機能", () => {
    it("カードが自然順序でソートされる", () => {
      const sorted = filterStore.sortedAndFilteredCards;

      // ID順にソートされているか確認
      expect(sorted[0].id).toBe("card-001");
      expect(sorted[1].id).toBe("card-002");
      expect(sorted[2].id).toBe("card-003");
      expect(sorted[3].id).toBe("card-004");
    });

    it("デッキカードが正しくソートされる", () => {
      // デッキにカードを追加（逆順）
      deckStore.addCardToDeck(mockCards[3]); // card-004
      deckStore.addCardToDeck(mockCards[1]); // card-002
      deckStore.addCardToDeck(mockCards[0]); // card-001

      const sorted = deckStore.sortedDeckCards;

      // ソート順の確認
      expect(sorted[0].card.id).toBe("card-001");
      expect(sorted[1].card.id).toBe("card-002");
      expect(sorted[2].card.id).toBe("card-004");
    });
  });

  describe("デッキ名管理", () => {
    it("デッキ名を設定できる", () => {
      const deckName = "テストデッキ";

      deckStore.setDeckName(deckName);

      expect(deckStore.deckName).toBe(deckName);
    });

    it("デッキ名をリセットできる", () => {
      deckStore.setDeckName("テストデッキ");
      deckStore.resetDeckName();

      expect(deckStore.deckName).toBe("");
    });
  });

  describe("エラーハンドリング統合", () => {
    it("存在しないカードのカウント操作でエラーハンドリングされる", () => {
      const mockToast = vi.fn();
      deckStore.setToastFunction(mockToast);

      // 存在しないカードのカウント増加
      deckStore.incrementCardCount("non-existent-card");

      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("見つかりません"),
        "error"
      );
    });

    it("存在しないカードのカウント減少でエラーハンドリングされる", () => {
      const mockToast = vi.fn();
      deckStore.setToastFunction(mockToast);

      // 存在しないカードのカウント減少
      deckStore.decrementCardCount("non-existent-card");

      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining("見つかりません"),
        "error"
      );
    });
  });

  describe("パフォーマンス考慮", () => {
    it("大量のカードでもフィルタリングが動作する", () => {
      // 大量のカードを作成
      const manyCards: Card[] = [];
      for (let i = 0; i < 1000; i++) {
        manyCards.push({
          id: `card-${i.toString().padStart(3, "0")}`,
          name: `カード ${i}`,
          kind: i % 2 === 0 ? { type: "Magic" } : { type: "Artist" },
          type: { type: "color", value: "赤" },
          tags: [`タグ${i % 5}`],
        });
      }

      cardsStore.availableCards = manyCards;

      // フィルター適用
      const startTime = performance.now();
      filterStore.toggleKindFilter("Magic");
      const filtered = filterStore.sortedAndFilteredCards;
      const endTime = performance.now();

      // 結果の確認
      expect(filtered).toHaveLength(500); // 半分がMagic
      expect(endTime - startTime).toBeLessThan(100); // 100ms以下
    });
  });
});
