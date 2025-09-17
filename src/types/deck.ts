/**
 * spec: デッキ機能のドメイン型(ADT)と不変条件を定義するモジュール。
 * - 例外は投げず Effect の Effect とエラーADTを使用する。
 * - UI文言は保持せず、構造化エラーで表現する。
 */
import type { Card } from "./card";
import { Data } from "effect";

/**
 * デッキ内のカードとその枚数を表すインターフェース。
 * @property card - デッキに含まれるカードオブジェクト。
 * @property count - そのカードの枚数（1以上の整数。0は DeckOperation.setCount 側で削除を意味）。
 */
export interface DeckCard {
  readonly card: Card;
  readonly count: number;
}

/**
 * デッキの現在の状態を表す代数的データ型。
 * - `empty`: デッキが空の状態。
 * - `valid`: デッキが有効な状態。カードリストと合計枚数を含む。
 * - `invalid`: デッキが無効な状態。カードリスト、合計枚数、およびエラーのリストを含む。
 * 不変条件:
 * - `valid`/`invalid` の `totalCount` は `cards.map(c => c.count).sum()` と一致する。
 */
export type DeckState =
  | { readonly type: "empty" }
  | {
      readonly type: "valid";
      readonly cards: readonly DeckCard[];
      readonly totalCount: number;
    }
  | {
      readonly type: "invalid";
      readonly cards: readonly DeckCard[];
      readonly totalCount: number;
      readonly errors: readonly string[];
    };

/**
 * デッキ操作中に発生しうるエラーを表す代数的データ型。
 * - `CardNotFound`: 指定されたカードが見つからない。
 * - `MaxCountExceeded`: カードの最大枚数制限を超過した。
 * - `InvalidCardCount`: 不正なカード枚数が指定された。
 */
export class DeckOperationError extends Data.TaggedError("DeckOperationError")<{
  readonly type: "CardNotFound" | "MaxCountExceeded" | "InvalidCardCount";
  readonly cardId: string;
  readonly maxCount?: number;
  readonly count?: number;
}> {}

/**
 * デッキコードの生成、コピー、検証、デコード中に発生しうるエラーを表す代数的データ型。
 * - `generation`: デッキコード生成時のエラー。
 * - `copy`: デッキコードコピー時のエラー。
 * - `validation`: デッキコード検証時のエラー。
 * - `decode`: デッキコードデコード時のエラー。
 */
export class DeckCodeError extends Data.TaggedError("DeckCodeError")<{
  readonly type: "generation" | "copy" | "validation" | "decode";
  readonly message: string;
  readonly invalidId?: string;
  readonly notFoundIds?: readonly string[];
  readonly originalError?: unknown;
}> {}

/**
 * デッキに対する変更操作を表す代数的データ型。
 * - `addCard`: カードをデッキに追加する。
 * - `removeCard`: 指定されたカードをデッキから削除する。
 * - `incrementCount`: 指定されたカードの枚数を増やす。
 * - `decrementCount`: 指定されたカードの枚数を減らす。
 * - `setCount`: 指定されたカードの枚数を設定する。
 * - `clear`: デッキの内容をすべてクリアする。
 */
export type DeckOperation =
  | { readonly type: "addCard"; readonly card: Card }
  | { readonly type: "removeCard"; readonly cardId: string }
  | { readonly type: "incrementCount"; readonly cardId: string }
  | { readonly type: "decrementCount"; readonly cardId: string }
  | {
      readonly type: "setCount";
      readonly cardId: string;
      readonly count: number; // 0は対象カードの削除を意味する
    }
  | { readonly type: "clear" };