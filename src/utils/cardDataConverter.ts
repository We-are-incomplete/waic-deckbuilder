/**
 * @file cardDataConverter.ts
 * @brief CSV形式のカードデータを読み込み、パースしてCardオブジェクトの配列に変換するユーティリティ。
 *        外部のCSVファイルからカードデータを取得し、アプリケーションで利用可能な形式に整形する機能を提供します。
 *        neverthrow Result型を使用して、成功または失敗の結果を明示的に扱います。
 */

import type { Card, CardKind, CardType } from "../types/card";
import { type Result, ok, err, fromThrowable } from "neverthrow";
import Papa from "papaparse"; // papaparseをインポート

export async function loadCardsFromCsv(
  csvPath: string,
): Promise<Result<Card[], Error>> {
  console.log("Attempting to fetch CSV from:", csvPath); // デバッグログ

  try {
    // 通常のfetch APIを使用（useFetchの代わり）
    const response = await fetch(csvPath, {
      method: "GET",
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      return err(
        new Error(
          `HTTP error! status: ${response.status} ${response.statusText}`,
        ),
      );
    }

    const csvText = await response.text();

    if (!csvText || csvText.trim().length === 0) {
      return err(new Error("CSVデータが空です。"));
    }

    if (import.meta.env?.DEV) {
      console.debug("CSV data fetched successfully, length:", csvText.length);
    }

    // papaparse を使用してCSVをパース
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
    return err(
      new Error(
        `ネットワークエラー: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
}

function parseCsv(csvText: string): Card[] {
  console.log("Parsing CSV text with PapaParse..."); // デバッグログ
  const parseResult = Papa.parse<any>(csvText, {
    header: true, // ヘッダー行をオブジェクトのキーとして使用
    skipEmptyLines: true, // 空行をスキップ
    transform: (value, field) => {
      // 各フィールドの値を変換
      if (field === "type" || field === "tags") {
        // 'type' と 'tags' フィールドは '/' で分割して配列にする
        return value ? value.split("/").map((s: string) => s.trim()) : [];
      }
      return value;
    },
  });

  if (parseResult.errors.length > 0) {
    console.error("PapaParse errors:", parseResult.errors);
    throw new Error(`CSVパースエラー: ${parseResult.errors[0].message}`);
  }

  const cards: Card[] = parseResult.data.map((row: any) => {
    // CardKindとCardTypeへの型アサーション
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as CardKind,
      type: row.type as CardType[], // transformで配列になっていることを期待
      effect: row.effect, // effectプロパティを追加
      tags: row.tags, // transformで配列になっていることを期待
    } as Card;
  });

  console.log("Successfully parsed cards:", cards.length); // デバッグログ
  return cards;
}
