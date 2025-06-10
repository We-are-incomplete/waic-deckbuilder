export type CardKind =
  | { readonly type: "Artist" }
  | { readonly type: "Song" }
  | { readonly type: "Magic" }
  | { readonly type: "Direction" };

export type CardType =
  | {
      readonly type: "color";
      readonly value: "赤" | "青" | "黄" | "白" | "黒" | "全";
    }
  | { readonly type: "timing"; readonly value: "即時" }
  | { readonly type: "equipment"; readonly value: "装備" }
  | { readonly type: "installation"; readonly value: "設置" };

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly kind: CardKind;
  readonly type: CardType | readonly CardType[];
  readonly tags?: readonly string[];
}
