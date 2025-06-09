import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
  removeDeckCardsFromLocalStorage,
  removeDeckNameFromLocalStorage,
} from "./storage";
import type { Card } from "../types/card";
import type { DeckCard } from "../types/deck";
import { STORAGE_KEYS } from "../constants/storage";

// LocalStorageのモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("storage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const mockCard: Card = {
    id: "test-card-1",
    name: "テストカード",
    kind: "Artist",
    type: "赤",
    tags: ["タグ1"],
  };

  const mockDeckCard: DeckCard = {
    card: mockCard,
    count: 2,
  };

  describe("saveDeckToLocalStorage", () => {
    it("デッキを正常に保存する", () => {
      const result = saveDeckToLocalStorage([mockDeckCard]);

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DECK_CARDS,
        JSON.stringify([{ id: "test-card-1", count: 2 }])
      );
    });

    it("デッキが指定されていない場合にエラーを返す", () => {
      // @ts-expect-error 意図的にnullを渡している
      const result = saveDeckToLocalStorage(null);

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe("デッキが指定されていません");
    });
  });

  describe("loadDeckFromLocalStorage", () => {
    it("保存されたデッキを正常に読み込む", () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify([{ id: "test-card-1", count: 2 }])
      );

      const result = loadDeckFromLocalStorage([mockCard]);

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(result.value).toEqual([mockDeckCard]);
    });

    it("保存されたデッキがない場合に空配列を返す", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = loadDeckFromLocalStorage([mockCard]);

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(result.value).toEqual([]);
    });

    it("利用可能なカードが指定されていない場合にエラーを返す", () => {
      // @ts-expect-error 意図的にnullを渡している
      const result = loadDeckFromLocalStorage(null);

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe("利用可能なカードが指定されていません");
    });
  });

  describe("saveDeckName", () => {
    it("デッキ名を正常に保存する", () => {
      const result = saveDeckName("テストデッキ");

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DECK_NAME,
        "テストデッキ"
      );
    });

    it("デッキ名が指定されていない場合にエラーを返す", () => {
      const result = saveDeckName("");

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe("デッキ名が指定されていません");
    });
  });

  describe("loadDeckName", () => {
    it("保存されたデッキ名を正常に読み込む", () => {
      localStorageMock.getItem.mockReturnValue("保存されたデッキ");

      const result = loadDeckName();

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(result.value).toBe("保存されたデッキ");
    });

    it("保存されたデッキ名がない場合にデフォルト名を返す", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = loadDeckName();

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(result.value).toBe("新しいデッキ");
    });
  });

  describe("removeDeckCardsFromLocalStorage", () => {
    it("デッキカードを正常に削除する", () => {
      const result = removeDeckCardsFromLocalStorage();

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DECK_CARDS
      );
    });
  });

  describe("removeDeckNameFromLocalStorage", () => {
    it("デッキ名を正常に削除する", () => {
      const result = removeDeckNameFromLocalStorage();

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DECK_NAME
      );
    });
  });
});
