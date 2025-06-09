import { describe, it, expect } from "vitest";
import {
  createDeckCard,
  calculateTotalCards,
  calculateDeckState,
  addCardToDeck,
  setCardCount,
  removeCardFromDeck,
  incrementCardCount,
  decrementCardCount,
  executeDeckOperation,
  createDeckDetails,
} from "../../domain/deck";
import type { Card } from "../../types/card";
import type { DeckCard, DeckOperation } from "../../types/deck";

describe("domain/deck", () => {
  // テスト用のカードデータ
  const createTestCard = (id: string, name: string): Card => ({
    id,
    name,
    kind: { type: "Artist" },
    type: { type: "color", value: "赤" },
    tags: ["テスト"],
  });

  const testCard1 = createTestCard("test-001", "テストカード1");
  const testCard2 = createTestCard("test-002", "テストカード2");
  const testCard3 = createTestCard("test-003", "テストカード3");

  describe("createDeckCard", () => {
    it("正常なデッキカードを作成できる", () => {
      const result = createDeckCard(testCard1, 3);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          card: testCard1,
          count: 3,
        });
      }
    });

    it("枚数が1未満の場合はエラーを返す", () => {
      const result = createDeckCard(testCard1, 0);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toEqual({
          type: "invalidCardCount",
          cardId: testCard1.id,
          count: 0,
        });
      }
    });

    it("枚数が上限を超える場合はエラーを返す", () => {
      const result = createDeckCard(testCard1, 5);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toEqual({
          type: "maxCountExceeded",
          cardId: testCard1.id,
          maxCount: 4,
        });
      }
    });
  });

  describe("calculateTotalCards", () => {
    it("空のデッキの場合は0を返す", () => {
      const result = calculateTotalCards([]);
      expect(result).toBe(0);
    });

    it("正しく合計枚数を計算する", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 3 },
        { card: testCard2, count: 2 },
        { card: testCard3, count: 1 },
      ];

      const result = calculateTotalCards(deckCards);
      expect(result).toBe(6);
    });
  });

  describe("calculateDeckState", () => {
    it("空のデッキの場合はempty状態を返す", () => {
      const result = calculateDeckState([]);

      expect(result).toEqual({ type: "empty" });
    });

    it("正常なデッキの場合はvalid状態を返す", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 3 },
        { card: testCard2, count: 2 },
      ];

      const result = calculateDeckState(deckCards);

      expect(result.type).toBe("valid");
      if (result.type === "valid") {
        expect(result.cards).toEqual(deckCards);
        expect(result.totalCount).toBe(5);
      }
    });

    it("無効なカード枚数がある場合はinvalid状態を返す", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 0 },
        { card: testCard2, count: 5 },
      ];

      const result = calculateDeckState(deckCards);

      expect(result.type).toBe("invalid");
      if (result.type === "invalid") {
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain("無効です");
        expect(result.errors[1]).toContain("上限を超えています");
      }
    });

    it("デッキサイズが上限を超える場合はinvalid状態を返す", () => {
      // 60枚を超えるデッキを作成
      const deckCards: DeckCard[] = Array.from({ length: 16 }, (_, i) => ({
        card: createTestCard(`test-${i}`, `テストカード${i}`),
        count: 4,
      })); // 16 × 4 = 64枚

      const result = calculateDeckState(deckCards);

      expect(result.type).toBe("invalid");
      if (result.type === "invalid") {
        expect(
          result.errors.some((error) =>
            error.includes("デッキサイズが上限を超えています")
          )
        ).toBe(true);
      }
    });
  });

  describe("addCardToDeck", () => {
    it("新しいカードをデッキに追加できる", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = addCardToDeck(deckCards, testCard2);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[1]).toEqual({
          card: testCard2,
          count: 1,
        });
      }
    });

    it("既存のカードの枚数を増やせる", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = addCardToDeck(deckCards, testCard1);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].count).toBe(3);
      }
    });

    it("カード枚数が上限の場合はエラーを返す", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 4 }];

      const result = addCardToDeck(deckCards, testCard1);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("maxCountExceeded");
      }
    });

    it("デッキサイズが上限を超える場合はエラーを返す", () => {
      // 60枚のデッキを作成
      const deckCards: DeckCard[] = Array.from({ length: 15 }, (_, i) => ({
        card: createTestCard(`test-${i}`, `テストカード${i}`),
        count: 4,
      })); // 15 × 4 = 60枚

      const result = addCardToDeck(deckCards, testCard1);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("deckSizeExceeded");
      }
    });
  });

  describe("setCardCount", () => {
    it("既存カードの枚数を設定できる", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = setCardCount(deckCards, testCard1.id, 4);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].count).toBe(4);
      }
    });

    it("枚数を0に設定するとカードが削除される", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 2 },
        { card: testCard2, count: 3 },
      ];

      const result = setCardCount(deckCards, testCard1.id, 0);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].card.id).toBe(testCard2.id);
      }
    });

    it("存在しないカードの場合はエラーを返す", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = setCardCount(deckCards, "nonexistent", 3);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("cardNotFound");
      }
    });

    it("負の枚数の場合はエラーを返す", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = setCardCount(deckCards, testCard1.id, -1);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("invalidCardCount");
      }
    });
  });

  describe("removeCardFromDeck", () => {
    it("カードをデッキから削除できる", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 2 },
        { card: testCard2, count: 3 },
      ];

      const result = removeCardFromDeck(deckCards, testCard1.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].card.id).toBe(testCard2.id);
      }
    });

    it("存在しないカードの場合はエラーを返す", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = removeCardFromDeck(deckCards, "nonexistent");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("cardNotFound");
      }
    });
  });

  describe("incrementCardCount", () => {
    it("カード枚数を1増やせる", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = incrementCardCount(deckCards, testCard1.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].count).toBe(3);
      }
    });

    it("存在しないカードの場合はエラーを返す", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = incrementCardCount(deckCards, "nonexistent");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("cardNotFound");
      }
    });
  });

  describe("decrementCardCount", () => {
    it("カード枚数を1減らせる", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 3 }];

      const result = decrementCardCount(deckCards, testCard1.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].count).toBe(2);
      }
    });

    it("枚数が1の場合はカードが削除される", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 1 },
        { card: testCard2, count: 2 },
      ];

      const result = decrementCardCount(deckCards, testCard1.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].card.id).toBe(testCard2.id);
      }
    });
  });

  describe("executeDeckOperation", () => {
    it("addCard操作を実行できる", () => {
      const deckCards: DeckCard[] = [];
      const operation: DeckOperation = {
        type: "addCard",
        card: testCard1,
      };

      const result = executeDeckOperation(deckCards, operation);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].card.id).toBe(testCard1.id);
      }
    });

    it("setCount操作を実行できる", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];
      const operation: DeckOperation = {
        type: "setCount",
        cardId: testCard1.id,
        count: 4,
      };

      const result = executeDeckOperation(deckCards, operation);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].count).toBe(4);
      }
    });

    it("removeCard操作を実行できる", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 2 },
        { card: testCard2, count: 3 },
      ];
      const operation: DeckOperation = {
        type: "removeCard",
        cardId: testCard1.id,
      };

      const result = executeDeckOperation(deckCards, operation);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].card.id).toBe(testCard2.id);
      }
    });
  });

  describe("createDeckDetails", () => {
    it("デッキ詳細を作成できる", () => {
      const deckCards: DeckCard[] = [
        { card: testCard1, count: 2 },
        { card: testCard2, count: 3 },
      ];
      const createdAt = new Date("2024-01-01");
      const modifiedAt = new Date("2024-01-02");

      const result = createDeckDetails(
        "テストデッキ",
        deckCards,
        createdAt,
        modifiedAt
      );

      expect(result).toEqual({
        name: "テストデッキ",
        cards: deckCards,
        totalCount: 5,
        createdAt,
        modifiedAt,
      });
    });

    it("日時を省略した場合は現在時刻が設定される", () => {
      const deckCards: DeckCard[] = [{ card: testCard1, count: 2 }];

      const result = createDeckDetails("テストデッキ", deckCards);

      expect(result.name).toBe("テストデッキ");
      expect(result.cards).toEqual(deckCards);
      expect(result.totalCount).toBe(2);
      expect(result.createdAt).toBeUndefined();
      expect(result.modifiedAt).toBeInstanceOf(Date);
    });
  });
});
