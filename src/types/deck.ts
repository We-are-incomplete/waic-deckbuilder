import type { Card } from "./card";

export interface DeckCard {
  readonly card: Card;
  count: number;
}
