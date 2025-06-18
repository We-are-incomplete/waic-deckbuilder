export type CardKind = "Artist" | "Song" | "Magic" | "Direction";

export type CardType = "赤" | "青" | "黄" | "白" | "黒" | "全" | "即時" | "装備" | "設置";

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly kind: CardKind;
  readonly type: CardType;
  readonly tags?: readonly string[];
}
