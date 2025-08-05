/**
 * @file cardDataConverter.ts
 * @brief CSV形式のカードデータを読み込み、パースしてCardオブジェクトの配列に変換するユーティリティ。
 *        外部のCSVファイルからカードデータを取得し、アプリケーションで利用可能な形式に整形する機能を提供します。
 *        neverthrow Result型を使用して、成功または失敗の結果を明示的に扱います。
 */

import type { Card, CardKind, CardType } from "../types/card";
import { type Result, ok, err } from "neverthrow";
import { useFetch } from "@vueuse/core";
import { watchEffect } from "vue";

export async function loadCardsFromCsv(
  csvPath: string,
): Promise<Result<Card[], Error>> {
  console.log("Attempting to fetch CSV from:", csvPath); // デバッグログ

  const { data, error, isFetching } = useFetch(csvPath, { refetch: true }).text();

  // useFetchはリアクティブな参照を返すため、Promiseとして扱うためにawaitで解決
  await new Promise<void>((resolve) => {
    const stopWatch = watchEffect(() => {
      if (!isFetching.value) {
        stopWatch();
        resolve();
      }
    });
  });

  if (error.value) {
    return err(new Error(`HTTP error! status: ${error.value.message}`));
  }

  if (data.value === null) {
    return err(new Error("CSVデータが取得できませんでした。"));
  }

  try {
    return ok(parseCsv(data.value));
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
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
