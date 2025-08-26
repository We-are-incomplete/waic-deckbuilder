/**
 * カードの種類を表す型。
 * - Artist: アーティストカード
 * - Song: ソングカード
 * - Magic: マジックカード
 * - Direction: ディレクションカード
 */
export type CardKind = "Artist" | "Song" | "Magic" | "Direction";

/**
 * カードのタイプ（色や属性）を表す型。
 * - 赤, 青, 黄, 白, 黒, 全: 色属性
 * - 即時, 装備, 設置: カードのプレイタイプ
 */
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

/**
 * 個々のカードの情報を表すインターフェース。
 * @property id - カードの一意な識別子。
 * @property name - カード名。
 * @property kind - カードの種類（Artist, Song, Magic, Direction）。
 * @property type - カードのタイプ（色やプレイタイプ）。色は複数持つ場合がある。
 * @property effect - カードの効果テキスト。
 * @property hasEntryCondition - 【登場条件】を持つカードかどうかを示す真偽値。
 * @property tags - カードに関連付けられたタグのリスト。
 */
export interface Card {
  readonly id: string;
  readonly name: string;
  readonly kind: CardKind;
  readonly type: readonly CardType[];
  readonly effect?: string;
  readonly hasEntryCondition?: boolean;
  readonly tags?: readonly string[];
}
