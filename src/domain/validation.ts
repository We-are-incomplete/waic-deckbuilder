/**
 * @file バリデーション共通スキーマ
 *
 * 目的:
 * - ドメイン横断で利用する valibot スキーマを集約し、再利用性と一貫性を高める。
 * 方針:
 * - 純粋関数/不変データ
 * - 早期リターン
 * - API最小化（必要なスキーマのみ公開）
 */

import * as v from "valibot";
import { CARD_KINDS, CARD_TYPES, GAME_CONSTANTS } from "../constants";

// ------------------------------------------------------------
// 基本スキーマ（CardKind / CardType）
// ------------------------------------------------------------
export const CardKindSchema = v.picklist(CARD_KINDS);
export const CardTypeSchema = v.picklist(CARD_TYPES);

// ------------------------------------------------------------
// CardId スキーマ（例: exA-1, JA-10, prmD-9 など）
// ex/prm もしくは A..Z のいずれか + [A|S|M|D] + "-" + 数字
// ------------------------------------------------------------
export const CARD_ID_REGEX = /^([A-Z]|ex|prm)(A|S|M|D)-\d+$/;

export const CardIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("カードIDが空です"),
  v.check((s) => CARD_ID_REGEX.test(s), "カードIDの形式が不正です"),
);

// ------------------------------------------------------------
// スラッシュ区切りデッキコード（cardId を '/' で連結）
// - 空/先頭末尾'/'/連続'//' を禁止
// - 各トークンが CardIdSchema に適合する
// - 長さ制限
// ------------------------------------------------------------
export const SlashDeckCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("デッキコードが空です"),
  v.maxLength(
    GAME_CONSTANTS.MAX_DECK_CODE_LENGTH,
    `デッキコードが長すぎます（最大${GAME_CONSTANTS.MAX_DECK_CODE_LENGTH}文字）`,
  ),
  v.check(
    (s) => !s.startsWith("/") && !s.endsWith("/"),
    "先頭/末尾の'/'は無効です",
  ),
  v.check((s) => !s.includes("//"), "連続した'//'は無効です"),
  v.check(
    (s) => s.split("/").every((id) => CARD_ID_REGEX.test(id.trim())),
    "無効なカードIDが含まれます",
  ),
);
