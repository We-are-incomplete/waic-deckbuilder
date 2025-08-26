import type { Card } from "./card";
import type { Result } from "neverthrow";

/**
 * デッキ内のカードとその枚数を表すインターフェース。
 * @property card - デッキに含まれるカードオブジェクト。
 * @property count - そのカードの枚数。
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
 * デッキ操作の結果を表す型。成功時は `T`、失敗時は `DeckOperationError` を返す。
 */
export type DeckOperationResult<T> = Result<T, DeckOperationError>;

/**
 * デッキ操作中に発生しうるエラーを表す代数的データ型。
 * - `cardNotFound`: 指定されたカードが見つからない。
 * - `maxCountExceeded`: カードの最大枚数制限を超過した。
 * - `invalidCardCount`: 不正なカード枚数が指定された。
 * - `deckSizeExceeded`: デッキの合計枚数制限を超過した。
 * - `unknown`: その他の不明なエラー。
 */
export type DeckOperationError =
  | { readonly type: "cardNotFound"; readonly cardId: string }
  | {
      readonly type: "maxCountExceeded";
      readonly cardId: string;
      readonly maxCount: number;
    }
  | {
      readonly type: "invalidCardCount";
      readonly cardId: string;
      readonly count: number;
    }
  | {
      readonly type: "deckSizeExceeded";
      readonly currentSize: number;
      readonly maxSize: number;
    }
  | { readonly type: "unknown"; readonly message: string };

/**
 * デッキコードの生成、コピー、検証、デコード中に発生しうるエラーを表す代数的データ型。
 * - `generation`: デッキコード生成時のエラー。
 * - `copy`: デッキコードコピー時のエラー。
 * - `validation`: デッキコード検証時のエラー。
 * - `decode`: デッキコードデコード時のエラー。
 */
export type DeckCodeError =
  | { readonly type: "generation"; readonly message: string }
  | { readonly type: "copy"; readonly message: string }
  | { readonly type: "validation"; readonly message: string }
  | { readonly type: "decode"; readonly message: string };

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
      readonly count: number;
    }
  | { readonly type: "clear" };
