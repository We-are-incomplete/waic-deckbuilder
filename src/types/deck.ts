import type { Card } from "./card";
import type { Result } from "neverthrow";

// デッキカードの代数的データ型
export interface DeckCard {
  readonly card: Card;
  readonly count: number;
}

// デッキの状態を表す代数的データ型
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

// デッキ操作の結果型
export type DeckOperationResult<T> = Result<T, DeckOperationError>;

// デッキ操作エラー型
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

// デッキ変更操作の型
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
