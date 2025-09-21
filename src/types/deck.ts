/**
 * spec: デッキ機能のドメイン型(ADT)と不変条件を定義するモジュール。
 * - UI文言は保持せず、構造化エラーで表現する。
 */
import type { Card } from "./card";

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
      readonly errors: readonly DeckOperationError[];
    };

const getDeckOperationErrorMessage = (params: {
  type: "CardNotFound" | "MaxCountExceeded" | "InvalidCardCount";
  cardId: string;
  maxCount?: number;
  count?: number;
}): string => {
  switch (params.type) {
    case "CardNotFound":
      return `カードが見つかりません: ${params.cardId}`;
    case "MaxCountExceeded":
      return `最大枚数を超過しました: ${params.cardId} (最大: ${params.maxCount ?? "不明"})`;
    case "InvalidCardCount":
      return `不正なカード枚数です: ${params.cardId} (指定: ${params.count ?? "不明"})`;
    default:
      return `DeckOperationError: ${params.type} for card ${params.cardId}`;
  }
};

/**
 * デッキ操作中に発生しうるエラーを表す代数的データ型。
 * - `CardNotFound`: 指定されたカードが見つからない。
 * - `MaxCountExceeded`: カードの最大枚数制限を超過した。
 * - `InvalidCardCount`: 不正なカード枚数が指定された。
 */
export class DeckOperationError extends Error {
  readonly type: "CardNotFound" | "MaxCountExceeded" | "InvalidCardCount";
  readonly cardId: string;
  readonly maxCount?: number;
  readonly count?: number;

  constructor(params: {
    type: "CardNotFound" | "MaxCountExceeded" | "InvalidCardCount";
    cardId: string;
    maxCount?: number;
    count?: number;
  }) {
    super(getDeckOperationErrorMessage(params));
    this.name = "DeckOperationError";
    this.type = params.type;
    this.cardId = params.cardId;
    if (params.maxCount !== undefined) {
      this.maxCount = params.maxCount;
    }
    if (params.count !== undefined) {
      this.count = params.count;
    }
    Object.setPrototypeOf(this, DeckOperationError.prototype);
  }
}

/**
 * デッキコードの生成、コピー、検証、デコード中に発生しうるエラーを表す代数的データ型。
 * - `generation`: デッキコード生成時のエラー。
 * - `copy`: デッキコードコピー時のエラー。
 * - `validation`: デッキコード検証時のエラー。
 * - `decode`: デッキコードデコード時のエラー。
 */
export class DeckCodeError extends Error {
  readonly type: "generation" | "copy" | "validation" | "decode";
  readonly invalidId?: string;
  readonly notFoundIds?: readonly string[];
  readonly originalError?: unknown;

  constructor(params: {
    type: "generation" | "copy" | "validation" | "decode";
    message?: string;
    invalidId?: string;
    notFoundIds?: readonly string[];
    originalError?: unknown;
  }) {
    super(params.message);
    this.name = "DeckCodeError";
    this.type = params.type;
    if (params.invalidId !== undefined) {
      this.invalidId = params.invalidId;
    }
    if (params.notFoundIds !== undefined) {
      this.notFoundIds = params.notFoundIds;
    }
    if (params.originalError !== undefined) {
      this.originalError = params.originalError;
    }
    Object.setPrototypeOf(this, DeckCodeError.prototype);
  }
}

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
