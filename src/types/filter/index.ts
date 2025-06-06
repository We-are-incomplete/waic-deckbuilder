import type { CardKind, CardType } from "../card";

export interface FilterCriteria {
  text: string;
  kind: CardKind[];
  type: CardType[];
  tags: string[];
}
