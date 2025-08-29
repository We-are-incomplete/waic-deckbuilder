import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadCardsFromCsv } from "./cardDataConverter";
import type { Card } from "../types/card";

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
  beforeEach(() => {
    vi.clearAllMocks();
    // fetchのデフォルトモック（成功パス）
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => mockCsvContent,
      })),
    );
  });

  it("CSVデータを正しくパースし、JSONデータと一致すること", async () => {
    const result = await loadCardsFromCsv(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSBSkAVMH16J4iOgia3JKSwgpNG9gIWGu5a7OzdnuPmM2lvYW0MjchCBvy1i4ZS8aXJEPooubEivEfc/pub?gid=1598481515&single=true&output=csv",
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(mockJsonContent);
    }
  });

  it("空のCSVコンテンツを処理できること", async () => {
    // 次のfetch呼び出しだけヘッダのみを返す
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "id,name,kind,type,tags\n",
    } as Response);

    const result = await loadCardsFromCsv(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSBSkAVMH16J4iOgia3JKSwgpNG9gIWGu5a7OzdnuPmM2lvYW0MjchCBvy1i4ZS8aXJEPooubEivEfc/pub?gid=1598481515&single=true&output=csv",
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  it("存在しないCSVファイルを処理できること", async () => {
    // 次のfetch呼び出しだけ404を返す
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    } as Response);

    const result = await loadCardsFromCsv("/public/nonexistent.csv");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain(
        "HTTP error! status: 404 Not Found",
      );
    }
  });
});
