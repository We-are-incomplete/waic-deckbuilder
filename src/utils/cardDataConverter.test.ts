import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadCardsFromCsv } from "./cardDataConverter";
import type { Card } from "../types/card";

// useFetchをモック
vi.mock("@vueuse/core", () => ({
  useFetch: vi.fn(),
}));

// モックデータ
const mockCsvContent = `id,name,kind,type,tags
AA-1,【花魁鳥】花譜,Artist,"赤",花譜/進化/【登場】VOL獲得/【能力】VOL獲得/魔力Ω消費/SD花譜
AA-2,【花魁鳥】理芽,Artist,"青",理芽/進化/【登場】VOL獲得/【能力】VOL獲得/魔力Ω消費/SD理芽
AA-3,【花魁鳥】春猿火,Artist,"黄",春猿火/進化/【登場】VOL獲得/【能力】VOL獲得/魔力Ω消費/SD春猿火
`;

const mockJsonContent: Card[] = [
  {
    id: "AA-1",
    name: "【花魁鳥】花譜",
    kind: "Artist",
    type: ["赤"],
    tags: [
      "花譜",
      "進化",
      "【登場】VOL獲得",
      "【能力】VOL獲得",
      "魔力Ω消費",
      "SD花譜",
    ],
  },
  {
    id: "AA-2",
    name: "【花魁鳥】理芽",
    kind: "Artist",
    type: ["青"],
    tags: [
      "理芽",
      "進化",
      "【登場】VOL獲得",
      "【能力】VOL獲得",
      "魔力Ω消費",
      "SD理芽",
    ],
  },
  {
    id: "AA-3",
    name: "【花魁鳥】春猿火",
    kind: "Artist",
    type: ["黄"],
    tags: [
      "春猿火",
      "進化",
      "【登場】VOL獲得",
      "【能力】VOL獲得",
      "魔力Ω消費",
      "SD春猿火",
    ],
  },
];

describe("loadCardsFromCsv", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { useFetch } = await import("@vueuse/core");
    
    // useFetchのデフォルトモック
    (useFetch as any).mockReturnValue({
      text: () => ({
        data: { value: mockCsvContent },
        error: { value: null },
        isFetching: { value: false },
      }),
    });
  });

  it("CSVデータを正しくパースし、JSONデータと一致すること", async () => {
    const result = await loadCardsFromCsv("/public/cards.csv");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(mockJsonContent);
    }
  });

  it("空のCSVコンテンツを処理できること", async () => {
    const { useFetch } = await import("@vueuse/core");
    
    (useFetch as any).mockReturnValue({
      text: () => ({
        data: { value: "id,name,kind,type,tags\n" },
        error: { value: null },
        isFetching: { value: false },
      }),
    });
    
    const result = await loadCardsFromCsv("/public/cards.csv");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  it("存在しないCSVファイルを処理できること", async () => {
    const { useFetch } = await import("@vueuse/core");
    
    (useFetch as any).mockReturnValue({
      text: () => ({
        data: { value: null },
        error: { value: { message: "404 Not Found" } },
        isFetching: { value: false },
      }),
    });
    
    const result = await loadCardsFromCsv("/public/nonexistent.csv");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain("HTTP error! status: 404 Not Found");
    }
  });
});
