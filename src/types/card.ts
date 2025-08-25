export type CardKind = "Artist" | "Song" | "Magic" | "Direction";

export type CardType =
  | "赤"
  | "青"
  | "黄"
  | "白"
  | "黒"
  | "全"
  | "即時"
  | "装備"
  | "設置";

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly kind: CardKind;
  readonly type: readonly CardType[];
  readonly effect?: string; // 【登場条件】などの効果テキスト
  readonly hasEntryCondition?: boolean; // 【登場条件】を持つカードかどうか
  readonly tags?: readonly string[];
}
