import type { CardKind, CardType } from "./card";

// フィルター条件の代数的データ型
export type FilterCondition =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "kind"; readonly values: readonly CardKind[] }
  | { readonly type: "cardType"; readonly values: readonly CardType[] }
  | { readonly type: "tags"; readonly values: readonly string[] }
  | {
      readonly type: "combined";
      readonly conditions: readonly FilterCondition[];
    };

// フィルター条件
export interface FilterCriteria {
  readonly text: string;
  readonly kind: readonly string[];
  readonly type: readonly string[];
  readonly tags: readonly string[];
  readonly hasEntryCondition?: boolean; // 【登場条件】で絞り込み
}
