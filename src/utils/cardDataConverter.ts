/**
 * @file cardDataConverter.ts
 * @brief CSV形式のカードデータを読み込み、パースしてCardオブジェクトの配列に変換するユーティリティ。
 *        外部のCSVファイルからカードデータを取得し、アプリケーションで利用可能な形式に整形する機能を提供します。
 *        neverthrow Result型を使用して、成功または失敗の結果を明示的に扱います。
 */

import type { Card, CardKind, CardType } from "../types/card";
import { type Result, ok, err, fromThrowable } from "neverthrow";

export async function loadCardsFromCsv(
  csvPath: string,
): Promise<Result<Card[], Error>> {
  console.log("Attempting to fetch CSV from:", csvPath); // デバッグログ

  try {
    // 通常のfetch APIを使用（useFetchの代わり）
    const response = await fetch(csvPath, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv,text/plain,*/*',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return err(new Error(`HTTP error! status: ${response.status} ${response.statusText}`));
    }

    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length === 0) {
      return err(new Error("CSVデータが空です。"));
    }

    console.log("CSV data fetched successfully, length:", csvText.length); // デバッグログ

    const parseResult = fromThrowable(() => parseCsv(csvText))();
    if (parseResult.isErr()) {
      return err(
        parseResult.error instanceof Error
          ? parseResult.error
          : new Error(String(parseResult.error)),
      );
    }
    return ok(parseResult.value);
  } catch (error) {
    console.error("Fetch error:", error); // デバッグログ
    return err(new Error(`ネットワークエラー: ${error instanceof Error ? error.message : String(error)}`));
  }
}

function parseCsv(csvText: string): Card[] {
  console.log("Parsing CSV text:", csvText.substring(0, 100) + "..."); // デバッグログ
  const lines = csvText.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    console.warn("CSV text is empty or contains only whitespace."); // デバッグログ
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  console.log("CSV Headers:", headers); // デバッグログ
  const cards: Card[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    console.log(`Parsing line ${i}:`, lines[i].substring(0, 50) + "..."); // デバッグログ
    console.log("Parsed values:", values); // デバッグログ
    const card: { [key: string]: any } = {};
    headers.forEach((header, index) => {
      const value = values[index];
      switch (header) {
        case "id":
          card.id = value;
          break;
        case "name":
          card.name = value;
          break;
        case "kind":
          card.kind = value as CardKind;
          break;
        case "type":
          card.type = value
            ? value.split("/").map((s: string) => s.trim() as CardType)
            : [];
          break;
        case "tags":
          card.tags = value
            ? value.split("/").map((s: string) => s.trim())
            : [];
          break;
        default:
          console.warn(`Unknown header: ${header}`);
      }
    });
    cards.push(card as Card);
  }
  console.log("Successfully parsed cards:", cards.length); // デバッグログ
  return cards;
}

// CSVの行をパースする関数（カンマ区切り、ダブルクォート対応）
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let currentField = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === "," && !inQuote) {
      result.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }
  result.push(currentField.trim()); // 最後のフィールドを追加
  return result;
}
