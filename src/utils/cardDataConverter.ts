/**
 * @file cardDataConverter.ts
 * @brief CSV形式のカードデータを読み込み、パースしてCardオブジェクトの配列に変換するユーティリティ。
 *        外部のCSVファイルからカードデータを取得し、アプリケーションで利用可能な形式に整形する機能を提供します。
 *        neverthrow Result型を使用して、成功または失敗の結果を明示的に扱います。
 */

import type { Card, CardKind, CardType } from "../types/card";
import { type Result, ok, err } from "neverthrow";
import Papa from "papaparse"; // papaparseをインポート

/**
 * CSVの生データ行の型定義
 */
interface CsvCardRow {
  id: string;
  name: string;
  kind: string;
  type: string; // CSVからは文字列として読み込まれるため
  effect: string;
  tags: string; // CSVからは文字列として読み込まれるため
}

// CardKindの有効な値を定義
const CARD_KINDS: readonly CardKind[] = ["Artist", "Song", "Magic", "Direction"];
// CardTypeの有効な値を定義
const CARD_TYPES: readonly CardType[] = [
  "赤",
  "青",
  "黄",
  "白",
  "黒",
  "全",
  "即時",
  "装備",
  "設置",
];

/**
 * 指定された値がCardKindのいずれかであるかを判定する型ガード
 * @param value 判定する値
 * @returns CardKindであればtrue、そうでなければfalse
 */
function isCardKind(value: string): value is CardKind {
  return (CARD_KINDS as readonly string[]).includes(value);
}

/**
 * 指定された値がCardTypeのいずれかであるかを判定する型ガード
 * @param value 判定する値
 * @returns CardTypeであればtrue、そうでなければfalse
 */
function isCardType(value: string): value is CardType {
  return (CARD_TYPES as readonly string[]).includes(value);
}

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
    const parseResult = parseCsv(csvText); // fromThrowableを削除し、直接Resultを処理
    if (parseResult.isErr()) {
      return err(parseResult.error);
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

function parseCsv(csvText: string): Result<Card[], Error> {
  console.log("Parsing CSV text with PapaParse..."); // デバッグログ
  const parseResult = Papa.parse<CsvCardRow>(csvText, {
    header: true, // ヘッダー行をオブジェクトのキーとして使用
    skipEmptyLines: true, // 空行をスキップ
    transform: (value, field) => {
      // 各フィールドの値を変換
      if (field === "type") {
        // 'type' フィールドは '/' で分割し、各要素をトリムして配列にする
        // ただし、"赤青"のような複合タイプはそのまま一つの要素として扱うのではなく、
        // "赤"と"青"に分割されるべき。
        // CSVのデータが "赤青" のようにスペースなしで結合されている場合、
        // それを "赤", "青" に分割するロジックを追加する。
        if (value === "赤青") return ["赤", "青"];
        if (value === "赤黄") return ["赤", "黄"];
        if (value === "赤白") return ["赤", "白"];
        if (value === "赤黒") return ["赤", "黒"];
        if (value === "青赤") return ["青", "赤"];
        if (value === "青黄") return ["青", "黄"];
        if (value === "青白") return ["青", "白"];
        if (value === "青黒") return ["青", "黒"];
        if (value === "黄赤") return ["黄", "赤"];
        if (value === "黄青") return ["黄", "青"];
        if (value === "黄白") return ["黄", "白"];
        if (value === "黄黒") return ["黄", "黒"];
        if (value === "白赤") return ["白", "赤"];
        if (value === "白青") return ["白", "青"];
        if (value === "白黄") return ["白", "黄"];
        if (value === "白黒") return ["白", "黒"];
        if (value === "黒赤") return ["黒", "赤"];
        if (value === "黒青") return ["黒", "青"];
        if (value === "黒黄") return ["黒", "黄"];
        if (value === "黒白") return ["黒", "白"];
        // その他の複合タイプもここに追加
        // "全" はそのまま "全" として扱う
        // "即時", "装備", "設置" もそのまま
        return value ? value.split("/").map((s: string) => s.trim()) : [];
      }
      if (field === "tags") {
        return value ? value.split("/").map((s: string) => s.trim()) : [];
      }
      return value;
    },
  });

  if (parseResult.errors.length > 0) {
    console.error("PapaParse errors:", parseResult.errors);
    return err(new Error(`CSVパースエラー: ${parseResult.errors[0].message}`));
  }

  const cards: Card[] = [];
  for (const row of parseResult.data) {
    // CardKindの検証
    if (!isCardKind(row.kind)) {
      return err(new Error(`不正なCardKindが見つかりました: ${row.kind} (ID: ${row.id})`));
    }

    // CardTypeの検証
    const types: CardType[] = [];
    // transformで配列になっていることを期待しているため、row.typeが配列であることを確認
    if (Array.isArray(row.type)) {
      for (const typeValue of row.type) {
        if (typeof typeValue === 'string' && isCardType(typeValue)) {
          types.push(typeValue);
        } else {
          return err(new Error(`不正なCardTypeが見つかりました: ${typeValue} (ID: ${row.id})`));
        }
      }
    } else if (typeof row.type === 'string' && row.type.trim() === '') {
      // 空文字列の場合は空配列として扱う
    } else {
      return err(new Error(`不正なCardType形式が見つかりました: ${row.type} (ID: ${row.id})`));
    }

    // tagsの検証 (string[]であることを期待)
    const tags: string[] = [];
    if (Array.isArray(row.tags)) {
      for (const tagValue of row.tags) {
        if (typeof tagValue === 'string') {
          tags.push(tagValue);
        } else {
          return err(new Error(`不正なタグ形式が見つかりました: ${tagValue} (ID: ${row.id})`));
        }
      }
    } else if (typeof row.tags === 'string' && row.tags.trim() === '') {
      // 空文字列の場合は空配列として扱う
    } else {
      return err(new Error(`不正なタグ形式が見つかりました: ${row.tags} (ID: ${row.id})`));
    }

    cards.push({
      id: row.id,
      name: row.name,
      kind: row.kind, // 型ガードによりCardKindとして扱える
      type: types,
      effect: row.effect,
      tags: tags,
    });
  }

  console.log("Successfully parsed cards:", cards.length); // デバッグログ
  return ok(cards);
}