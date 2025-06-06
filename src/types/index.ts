export interface Card {
  readonly id: string;
  readonly name: string;
  readonly kind: CardKind;
  readonly type: CardType | readonly CardType[];
  readonly tags?: readonly string[];
}

export interface DeckCard {
  readonly card: Card;
  count: number;
}

export interface FilterCriteria {
  text: string;
  kind: CardKind[];
  type: CardType[];
  tags: string[];
}

export interface ExportConfig {
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly backgroundColor: string;
    readonly padding: string;
  };
  readonly deckName: {
    readonly fontSize: string;
    readonly fontWeight: string;
    readonly color: string;
    readonly fontFamily: string;
  };
  readonly grid: {
    readonly gap: string;
  };
  readonly card: {
    readonly borderRadius: string;
  };
  readonly badge: {
    readonly backgroundColor: string;
    readonly color: string;
    readonly padding: string;
    readonly borderRadius: string;
    readonly fontSize: string;
  };
}

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
